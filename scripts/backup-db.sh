#!/usr/bin/env bash
# MySQL 备份脚本：mysqldump -> gzip -> 校验非空 -> 按天保留
#
# 用法（在能连到库的机器上跑，例如 NAS 的定时任务）：
#   DB_HOST=dev-mysql DB_USER=appuser DB_NAME=webCommand MYSQL_PWD=*** ./scripts/backup-db.sh
# 定时任务（每天 03:30，保留 14 天）：
#   30 3 * * * DB_HOST=... DB_USER=... DB_NAME=webCommand BACKUP_DIR=/volume1/backup/webcommand \
#     MYSQL_PWD=... /volume1/docker/webcommand/scripts/backup-db.sh >> /volume1/backup/webcommand/backup.log 2>&1
#
# 注意：MYSQL_PWD 通过环境变量传给 mysqldump，不要写成命令行参数（会出现在 ps 里）。
# 备份目录必须在另一块盘/另一台机器上留有副本，否则删库时备份跟着一起没了。
set -euo pipefail

: "${DB_HOST:?必须提供 DB_HOST}"
: "${DB_USER:?必须提供 DB_USER}"
: "${DB_NAME:?必须提供 DB_NAME}"
: "${MYSQL_PWD:*** 数据库口令必须通过环境变量传入}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/$DB_NAME-$STAMP.sql.gz"

echo "[$(date -Iseconds)] 开始备份 $DB_NAME -> $FILE"
mysqldump \
  --host="$DB_HOST" --user="$DB_USER" \
  --single-transaction --routines --triggers --default-character-set=utf8mb4 \
  --databases "$DB_NAME" | gzip > "$FILE"

# 空备份比没有备份更危险：它会让恢复时才发现什么都没有
SIZE="$(wc -c < "$FILE")"
if [ "$SIZE" -lt 1024 ]; then
  echo "[$(date -Iseconds)] ❌ 备份文件过小（${SIZE} 字节），判定为失败" >&2
  exit 1
fi
gzip -t "$FILE"
TABLES="$(gzip -dc "$FILE" | grep -c '^CREATE TABLE' || true)"
echo "[$(date -Iseconds)] 完成：${SIZE} 字节，含 $TABLES 张表"

DELETED="$(find "$BACKUP_DIR" -name "$DB_NAME-*.sql.gz" -mtime +"$KEEP_DAYS" -print -delete | wc -l)"
echo "[$(date -Iseconds)] 已清理 $DELETED 个超过 $KEEP_DAYS 天的旧备份"

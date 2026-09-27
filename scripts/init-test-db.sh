#!/usr/bin/env bash
# 生成本机隔离测试库所需的配置与 SQL。
#
# 为什么这么绕：appuser 在 NAS 上只有 USAGE ON *.*，没有 CREATE DATABASE 权限；
# 本机 mysqld 的 root 有口令，而我不该拿到它。所以本脚本只负责
# 「生成随机口令 + 写出 .env.test + 打印一段给你执行的 SQL」，
# 建库建账号那两步由你用管理员身份粘贴执行，我不接触任何管理员凭据。
#
# 用法：./scripts/init-test-db.sh          # 首次生成
#      ./scripts/init-test-db.sh --rotate # 重新生成口令
set -euo pipefail

cd "$(dirname "$0")/.."

TEST_DB="webcommand_test"
TEST_USER="webcommand_test"
ENV_FILE=".env.test"

if [ "${1:-}" = "--rotate" ]; then
  rm -f "$ENV_FILE"
fi

if [ -f "$ENV_FILE" ]; then
  PW="$(sed -n 's/^TEST_DB_PASSWORD=//p' "$ENV_FILE" | head -1)"
  [ -n "$PW" ] || { echo "❌ $ENV_FILE 存在但没有 TEST_DB_PASSWORD" >&2; exit 1; }
  echo "==> 复用已有口令（要重新生成用 --rotate）"
else
  PW="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")"
  umask 077
  cat > "$ENV_FILE" <<EOF
# 本机隔离测试库连接串（本文件已被 .gitignore 忽略，不要提交）
# 由 scripts/init-test-db.sh 生成；配合 scripts/init-test-db.sql 使用
TEST_DB_HOST=127.0.0.1
TEST_DB_PORT=3306
TEST_DB_NAME=$TEST_DB
TEST_DB_USER=$TEST_USER
TEST_DB_PASSWORD=$PW
EOF
  echo "==> 已生成 $ENV_FILE（0600，已 gitignore）"
fi

cat > scripts/init-test-db.sql <<EOF
-- 用管理员账号在本机 MySQL 执行；执行完即可跑 ./scripts/smoke-cloud-sync.sh
-- 只授权 $TEST_DB 这一个库，不给全局权限
CREATE DATABASE IF NOT EXISTS \`$TEST_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$TEST_USER'@'%' IDENTIFIED BY '$PW';
ALTER USER '$TEST_USER'@'%' IDENTIFIED BY '$PW';
GRANT ALL PRIVILEGES ON \`$TEST_DB\`.* TO '$TEST_USER'@'%';
FLUSH PRIVILEGES;
EOF
chmod 600 scripts/init-test-db.sql

echo
echo "==> 接下来请你做一次（仅此一步需要管理员身份）："
echo "    mysql -h 127.0.0.1 -u root -p < scripts/init-test-db.sql"
echo "    （或在你惯用的客户端里执行 scripts/init-test-db.sql）"
echo "    注意：该文件里含刚生成的测试口令，权限 0600 且已被 gitignore 忽略"
echo
echo "==> 完成后跑：./scripts/smoke-cloud-sync.sh"

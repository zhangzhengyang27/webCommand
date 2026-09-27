#!/usr/bin/env bash
# webCommand 部署脚本：本地构建 -> 安全检查 -> 同步到 NAS -> 重启容器 -> 探活
#
# 用法：
#   NAS_HOST=<NAS内网IP> NAS_USER=root NAS_PATH=/volume1/docker/webcommand ./scripts/deploy.sh
# 首次使用请先确认这三个变量（也可以写进同目录的 deploy.env，脚本会自动 source）。
#
# 设计要点：
# - 构建在本地做（NAS 上不装 node_modules），只同步 .output 与 Docker 相关文件；
# - 部署前强制检查产物里不含凭据，防止有人把私有配置改回构建期内联；
# - 探活失败时打印上一个镜像标签，由人决定要不要回滚（脚本不自动回滚，避免误判把线上反复横跳）。
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f scripts/deploy.env ] && source scripts/deploy.env

: "${NAS_HOST:?必须提供 NAS_HOST（部署目标主机）}"
: "${NAS_USER:?必须提供 NAS_USER}"
: "${NAS_PATH:?必须提供 NAS_PATH（NAS 上存放本工程 docker-compose 的目录）}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-webcommand-web}"
HEALTH_URL="${HEALTH_URL:-https://command.zhangzhengyang.com/api/health}"

DB_PASSWORD_VALUE="$(sed -n 's/^DB_PASSWORD=//p' .env | head -1 || true)"

echo "==> 1/5 构建"
pnpm build

echo "==> 2/5 检查产物不含凭据"
if [ -n "$DB_PASSWORD_VALUE" ] && grep -rqF -- "$DB_PASSWORD_VALUE" .output/; then
  echo "❌ .output 里出现了 .env 中的数据库口令，拒绝部署。" >&2
  echo "   私有配置必须由运行期环境变量注入（见 server/utils/appConfig.ts）。" >&2
  exit 1
fi
if grep -rqE "192\.168\.[0-9]+\.[0-9]+" .output/server/ 2>/dev/null; then
  echo "⚠️  产物里出现内网地址，请确认是否又把配置烘进了构建期" >&2
fi
echo "   产物干净"

echo "==> 3/5 同步到 NAS"
PREV_TAG="$(ssh "$NAS_USER@$NAS_HOST" \
  "docker images --format '{{.Tag}}' webcommand-web:latest 2>/dev/null | head -1" || true)"
rsync -az --delete \
  --include '.output/***' --include 'Dockerfile' --include '.dockerignore' \
  --include 'docker-compose.yml' --exclude '*' \
  ./ "$NAS_USER@$NAS_HOST:$NAS_PATH/"

echo "==> 4/5 重启容器"
ssh "$NAS_USER@$NAS_HOST" "cd $NAS_PATH && docker compose up -d --build $COMPOSE_SERVICE"

echo "==> 5/5 探活（最多等 60s）"
for i in $(seq 1 20); do
  sleep 3
  body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
  if echo "$body" | grep -q '"status":"ok"'; then
    echo "✅ 部署完成：$body"
    exit 0
  fi
  echo "   等待中… ($i/20)"
done

echo "❌ 探活失败，请手动检查：ssh $NAS_USER@$NAS_HOST 'cd $NAS_PATH && docker logs --tail 100 $COMPOSE_SERVICE'" >&2
if [ -n "$PREV_TAG" ]; then
  echo "   上一个可用镜像标签：webcommand-web:$PREV_TAG（可用 docker compose 指定后回滚）" >&2
fi
exit 1

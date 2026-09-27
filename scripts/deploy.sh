#!/usr/bin/env bash
# webCommand 部署辅助脚本：本地构建 + 产物凭据扫描 + 部署后核验
#
# 职责边界（重要）：**本脚本不做任何远端操作**。既有管线（Mac 构建 → tar 管道同步 →
# NAS docker compose --build → frp → VPS Nginx）依赖 .deploy-tmp 下的 expect 脚本与 NAS
# 口令，已验证可用且涉及交互认证，不该在这里重新实现一遍。
# 曾经这里写了 ssh + rsync --delete 的远端步骤，既缺 sudo / docker 全路径 /
# DOCKER_BUILDKIT=0 而根本跑不通，又会对 NAS 部署目录做删除操作 —— 已移除。
#
# 这里只补流水线里最容易出事的三件事：
#   1) 构建必须用 nvm 的 node（TRAE VM 的 x86_64 二进制会 exec format error）
#   2) 产物是否把凭据烘进去了（历史上真发生过：nuxt.config 读 process.env 让 .output
#      内含明文 DB 口令与内网地址，产物一外传就等于泄露）
#   3) 部署后 /api/health 是否真的 ok —— 它现在在库不通或表未就绪时返回 503，
#      能挡住"进程活着但注册登录全废"这种假健康
#
# 用法：
#   ./scripts/deploy.sh build     构建并扫描产物（默认）
#   ./scripts/deploy.sh verify    核验线上健康检查
set -euo pipefail

cd "$(dirname "$0")/.."

HEALTH_URL="${HEALTH_URL:-https://command.zhangzhengyang.com/api/health}"

scan_artifact() {
  local pw sp findings=0
  pw="$(sed -n 's/^DB_PASSWORD=//p' .env 2>/dev/null | head -1 || true)"
  sp="$(sed -n 's/^NUXT_SESSION_PASSWORD=//p' .env 2>/dev/null | head -1 || true)"

  if [ -n "$pw" ] && grep -rqF -- "$pw" .output/ 2>/dev/null; then
    echo "❌ .output 内含 .env 里的数据库口令，禁止部署" >&2
    echo "   私有配置必须走运行期注入（server/utils/appConfig.ts）；" >&2
    echo "   检查是否有人又把 process.env 读回了 nuxt.config 的 runtimeConfig。" >&2
    findings=$((findings + 1))
  fi
  if [ -n "$sp" ] && grep -rqF -- "$sp" .output/ 2>/dev/null; then
    echo "❌ .output 内含会话加密密钥，禁止部署" >&2
    findings=$((findings + 1))
  fi
  if grep -rqE "192\.168\.[0-9]+\.[0-9]+" .output/server/ 2>/dev/null; then
    echo "⚠️  产物里出现内网地址，确认不是又把配置烘进了构建期" >&2
  fi

  if [ "$findings" -gt 0 ]; then
    return 1
  fi
  echo "✅ 产物干净（不含口令与密钥）"
}

case "${1:-build}" in
  build)
    echo "==> 1/2 构建"
    export PATH="$HOME/.nvm/versions/node/v22.15.0/bin:$PATH"
    pnpm build
    echo "==> 2/2 扫描产物凭据"
    scan_artifact

    cat <<'NEXT'

==> 传输与重建请按《webCommand部署与避雷手册》§3 执行（本脚本不代做）：
    1) expect tar_src_pipe.exp <仓库路径> /volume1/docker/webcommand
    2) expect tar_nm_pipe.exp  <仓库路径> /volume1/docker/webcommand
       ⚠️ 第 2 步不能省：bsdtar 的 --exclude=node_modules 会连 .output/server/node_modules
          一起排掉，缺它容器会因 sequelize 找不到 mysql2 而崩溃循环
    3) NAS 上以 DOCKER_BUILDKIT=0 执行 docker compose up -d --build（btrfs + BuildKit 死锁）
    4) 回来跑：./scripts/deploy.sh verify
NEXT
    ;;
  verify)
    echo "==> 核验 $HEALTH_URL"
    if ! body="$(curl -fsS -m 15 "$HEALTH_URL" 2>&1)"; then
      echo "❌ 健康检查不是 2xx —— 库不通或表未就绪都会返回 503" >&2
      printf '%s\n' "$body" >&2
      exit 1
    fi
    printf '%s\n' "$body"
    case "$body" in
      *'"status":"ok"'*) echo "✅ 服务健康（库可达且表已就绪）" ;;
      *)
        echo "❌ 返回 2xx 但状态不是 ok" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "用法：$0 [build|verify]" >&2
    exit 2
    ;;
esac

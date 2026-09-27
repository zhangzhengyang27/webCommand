#!/usr/bin/env bash
# 本地质量门禁：格式 / lint / 类型 / 测试，一条命令跑完
#
# 仓库目前没有 git remote，所以先不做 GitHub Actions；等推到远端后，
# 让 CI 依次调用本脚本的等价步骤即可（见 README「质量门禁」）。
#
# 测试用 Node 原生类型剥离（node:test + .ts 用例），需要 Node >= 22.18 或 >= 24，
# 因此这里会主动挑一个可用的新版 node，而不是沿用当前 shell 里的旧版。
set -euo pipefail

cd "$(dirname "$0")/.."

node_ok() {
  # 主版本 >=23，或主版本 ==22 且次版本 >=18
  node -e 'const [M,m]=process.versions.node.split(".").map(Number);process.exit(M>22||(M===22&&m>=18)?0:1)'
}

if ! node_ok; then
  for candidate in "$HOME"/.nvm/versions/node/v*/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ] && "$candidate" -e '0' >/dev/null 2>&1; then
      M=$(basename "$(dirname "$(dirname "$candidate")")")
      if "$candidate" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; then
        export PATH="$(dirname "$candidate"):$PATH"
        echo "==> 当前 shell 的 node 过旧，改用 $M"
        break
      fi
    fi
  done
fi

if ! node_ok; then
  echo "❌ 需要 Node >= 22.18（测试用原生类型剥离跑 .ts 用例），当前 $(node -v)" >&2
  exit 1
fi

echo "==> node $(node -v)"
echo "==> 1/5 格式"
pnpm format:check
echo "==> 2/5 ESLint"
pnpm lint
echo "==> 3/5 类型"
pnpm typecheck
echo "==> 4/5 node:test（纯函数与静态契约）"
node --test "test/*.spec.ts"
echo "==> 5/5 vitest（路由层）"
node_modules/.bin/vitest run
echo "✅ 全部通过"

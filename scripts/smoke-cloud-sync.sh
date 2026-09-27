#!/usr/bin/env bash
# 云同步 / 账号链路的真实 DB 冒烟测试（对着本机 webcommand_test 库跑，绝不碰生产库）
#
# 覆盖的是"接口 + 存储 + 账号生命周期"这一层：
#   迁移器能否在真实 MySQL 8 上把表建出来（幂等）、blob 逐字往返（含 4 字节 emoji，验 utf8mb4）、
#   跨用户隔离、type 白名单、按类型尺寸上限、改密后旧密码失效、注销后无法再登录。
# 客户端的合并算法（写前合并 / 逐条 LWW / 墓碑）不在这里验，那部分由 test/cloudMerge.spec.ts 覆盖。
#
# 前置：先执行过 scripts/init-test-db.sql（见 scripts/init-test-db.sh 的提示）。
set -uo pipefail

cd "$(dirname "$0")/.."
[ -f .env.test ] || { echo "❌ 缺少 .env.test，请先跑 ./scripts/init-test-db.sh" >&2; exit 1; }
# shellcheck disable=SC1091
source .env.test

PORT="${SMOKE_PORT:-3100}"
BASE="http://127.0.0.1:$PORT"
RUN_ID="$(date +%s)$$"
USER_A="smoke_a_$RUN_ID"
USER_B="smoke_b_$RUN_ID"
PW_A='Sm0ke!PassAlpha'
PW_B='Sm0ke!PassBravo'
PW_A2='Sm0ke!PassAlpha2'
JAR_A="$(mktemp)" JAR_B="$(mktemp)" JAR_C="$(mktemp)"
LOG="$(mktemp)"
pass=0; fail=0

statusof() { # 只回 HTTP 状态码
  curl -sS -m 20 -o /dev/null -w '%{http_code}' -X "$2" -b "$1" -c "$1" \
    -H 'content-type: application/json' --data "$3" "$BASE$4"
}

req() { # req <jar> <method> <path> [json]
  local jar="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -m 20 -X "$method" -b "$jar" -c "$jar" -H 'content-type: application/json' \
      --data "$body" "$BASE$path"
  else
    curl -sS -m 20 -X "$method" -b "$jar" -c "$jar" "$BASE$path"
  fi
}

reqf() { # reqf <jar> <path> <json-file>
  curl -sS -m 30 -X POST -b "$1" -c "$1" -H 'content-type: application/json' \
    --data-binary "@$3" "$BASE$2"
}

jget() { # jget <json> <node表达式>
  printf '%s' "$1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);console.log(eval('o'+process.argv[1])??'')}catch(e){console.log('PARSE_ERR')}})" "$2"
}

expect() { # expect <说明> <期望> <实际>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ✓ $1"
  else fail=$((fail+1)); echo "  ✗ $1 — 期望 [$2] 实际 [$3]"; fi
}

echo "==> 启动 dev 服务（指向 $TEST_DB_NAME@${TEST_DB_HOST}:${TEST_DB_PORT}），日志：$LOG"
NUXT_DB_HOST="$TEST_DB_HOST" NUXT_DB_PORT="$TEST_DB_PORT" NUXT_DB_NAME="$TEST_DB_NAME" \
NUXT_DB_USER="$TEST_DB_USER" NUXT_DB_PASSWORD="$TEST_DB_PASSWORD" \
NUXT_TRUST_PROXY=false NUXT_SESSION_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")" \
npx nuxt dev --port "$PORT" --host 127.0.0.1 > "$LOG" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null; rm -f "$JAR_A" "$JAR_B" "$JAR_C"; }
trap cleanup EXIT

health=""
for _ in $(seq 1 60); do
  health="$(curl -sS -m 5 "$BASE/api/health" 2>/dev/null | tr -d '\n')"
  [ "$(jget "$health" .data.dbReachable)" = "true" ] && break
  sleep 2
done
echo "  health: $health"
[ "$(jget "$health" .data.dbReachable)" = "true" ] || { echo "❌ 连不上测试库，检查 scripts/init-test-db.sql 是否执行过" >&2; exit 1; }

# 防误写生产库的闸门：配置优先级出任何差错，应用就会连到 .env 里的 NAS 库，
# 而那边的 health 同样是 ok —— 所以这里用「迁移器有没有在测试库里建出表」来证明
# 它确实连的是 webcommand_test，再开始造任何数据。
echo "==> 0. 确认应用连的是测试库（迁移器应在测试库里建出 user / user_data）"
tables=""
for _ in $(seq 1 20); do
  tables="$(node --input-type=module -e "
import fs from 'node:fs'
import mysql from './node_modules/mysql2/promise.js'
const e = Object.fromEntries(fs.readFileSync('.env.test','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
try {
  const c = await mysql.createConnection({ host:e.TEST_DB_HOST, port:+e.TEST_DB_PORT, user:e.TEST_DB_USER, password:e.TEST_DB_PASSWORD, database:e.TEST_DB_NAME })
  const [r] = await c.query('SHOW TABLES')
  console.log(r.map(x=>Object.values(x)[0]).join(' '))
  await c.end()
} catch (err) { console.log('') }
" 2>/dev/null)"
  [[ " $tables " == *" user "* && " $tables " == *" user_data "* ]] && break
  sleep 2
done

if [[ " $tables " != *" user "* || " $tables " != *" user_data "* ]]; then
  echo "❌ 测试库里只看到 [$tables]，说明应用没连到 $TEST_DB_NAME —— 中止，避免把数据写进别的库" >&2
  tail -20 "$LOG"
  exit 1
fi
echo "  ✓ 迁移器已在测试库建表：$tables"


echo "==> 1. 迁移器在真实 MySQL 上把表建出来（schemaReady）"
expect "schemaReady=true（user / user_data 建表成功）" "true" "$(jget "$health" .data.schemaReady)"

echo "==> 2. 注册与登录"
r="$(req "$JAR_A" POST /api/user/register "{\"username\":\"$USER_A\",\"password\":\"$PW_A\",\"email\":\"$USER_A@test.local\"}")"
expect "注册成功 code=0" "0" "$(jget "$r" .code)"
r="$(req "$JAR_A" POST /api/user/login "{\"username\":\"$USER_A\",\"password\":\"$PW_A\",\"remember\":true}")"
expect "登录成功 code=0" "0" "$(jget "$r" .code)"
expect "当前用户回显正确" "$USER_A" "$(jget "$(req "$JAR_A" POST /api/user/current)" .data.username)"
r="$(req "$JAR_A" POST /api/user/login "{\"username\":\"$USER_A\",\"password\":\"wrong-password\"}")"
expect "错误口令登录被拒 code=40400" "40400" "$(jget "$r" .code)"

echo "==> 2.5 含 . + _ 的合法邮箱可注册（旧正则误杀过这类地址）"
r="$(req "$JAR_A" POST /api/user/register "{\"username\":\"smoke_dot_$RUN_ID\",\"password\":\"$PW_A\",\"email\":\"first.last+promo_$RUN_ID@test.local\"}")"
expect "带 . + _ 的邮箱注册成功 code=0" "0" "$(jget "$r" .code)"
r="$(req "$JAR_A" POST /api/user/register "{\"username\":\"smoke_bad_$RUN_ID\",\"password\":\"$PW_A\",\"email\":\"not-an-email\"}")"
expect "真非法邮箱仍被拒 code=40000" "40000" "$(jget "$r" .code)"

echo "==> 3. blob 逐字往返（含 4 字节 emoji，验 utf8mb4）"
BLOB='{"items":[{"id":"t1","name":"中文与🙂emoji混排 #🚀","isFinished":false,"updateTime":1700000000000}],"deleted":{}}'
r="$(req "$JAR_A" POST /api/data/sync "{\"type\":\"todo\",\"content\":$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$BLOB")}")"
expect "同步写入 code=0" "0" "$(jget "$r" .code)"
got="$(req "$JAR_A" GET "/api/data?type=todo" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).data??'')})")"
expect "读回内容与写入完全一致" "$BLOB" "$got"

echo "==> 4. 跨用户隔离（另一个账号读同一个 type 必须是空）"
r="$(req "$JAR_B" POST /api/user/register "{\"username\":\"$USER_B\",\"password\":\"$PW_B\",\"email\":\"$USER_B@test.local\"}")"
expect "第二个账号注册成功" "0" "$(jget "$r" .code)"
req "$JAR_B" POST /api/user/login "{\"username\":\"$USER_B\",\"password\":\"$PW_B\"}" >/dev/null
got="$(req "$JAR_B" GET "/api/data?type=todo" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).data)})")"
expect "读不到别人的 todo（data=null）" "null" "$got"

echo "==> 5. type 白名单与按类型尺寸上限"
r="$(req "$JAR_A" POST /api/data/sync '{"type":"role","content":"{}"}')"
expect "自造 type 被拒 code=40000" "40000" "$(jget "$r" .code)"
big_theme="$(node -e 'console.log(JSON.stringify({themeName:"a".repeat(70*1024),updatedAt:1}))')"
r="$(req "$JAR_A" POST /api/data/sync "{\"type\":\"theme\",\"content\":$big_theme}")"
expect "配置类超过 64KB 被拒" "40000" "$(jget "$r" .code)"
BIG_FILE="$(mktemp)"
node -e 'const c=JSON.stringify({items:"x".repeat(1024*1024+8)});process.stdout.write(JSON.stringify({type:"todo",content:c}))' > "$BIG_FILE"
r="$(reqf "$JAR_A" /api/data/sync "$BIG_FILE")"
rm -f "$BIG_FILE"
expect "数据类超过 1MB 被拒" "40000" "$(jget "$r" .code)"

echo "==> 6. 匿名访问一律 40100"
r="$(req /dev/null GET "/api/data?type=todo")"
expect "匿名读取 40100" "40100" "$(jget "$r" .code)"
r="$(req /dev/null POST /api/data/sync '{"type":"todo","content":"[]"}')"
expect "匿名写入 40100" "40100" "$(jget "$r" .code)"

echo "==> 7. 改密后旧密码失效"
r="$(req "$JAR_A" POST /api/user/password "{\"oldPassword\":\"$PW_A\",\"newPassword\":\"$PW_A2\"}")"
expect "改密成功 code=0" "0" "$(jget "$r" .code)"
r="$(req "$JAR_C" POST /api/user/login "{\"username\":\"$USER_A\",\"password\":\"$PW_A\"}")"
expect "旧密码登录被拒" "40400" "$(jget "$r" .code)"
r="$(req "$JAR_C" POST /api/user/login "{\"username\":\"$USER_A\",\"password\":\"$PW_A2\"}")"
expect "新密码登录成功" "0" "$(jget "$r" .code)"
r="$(req "$JAR_C" POST /api/user/password "{\"oldPassword\":\"$PW_A2\",\"newPassword\":\"short\"}")"
expect "新密码短于 8 位被拒（口令下限已生效）" "40000" "$(jget "$r" .code)"

# 前面的注册/登录已消耗 authLimiter（每 IP 10 次/分钟）的配额，等窗口过去再测注销，
# 否则拿到的是限流的 40000 而不是注销逻辑的结果。
echo "  （等 62s 让 authLimiter 窗口过去）"
sleep 62

echo "==> 8. 注销：确认串与口令都要对，删成功后不能再用口令登录"
r="$(req "$JAR_C" POST /api/user/delete "{\"password\":\"$PW_A2\",\"confirm\":\"wrong_name\"}")"
expect "确认串不匹配被拒 code=40000" "40000" "$(jget "$r" .code)"
r="$(req "$JAR_C" POST /api/user/delete "{\"password\":\"bad\",\"confirm\":\"$USER_A\"}")"
expect "口令错误被拒 code=40000" "40000" "$(jget "$r" .code)"
r="$(req "$JAR_C" POST /api/user/delete "{\"password\":\"$PW_A2\",\"confirm\":\"$USER_A\"}")"
expect "注销成功 code=0" "0" "$(jget "$r" .code)"
r="$(req "$JAR_C" POST /api/user/login "{\"username\":\"$USER_A\",\"password\":\"$PW_A2\"}")"
expect "注销后登录被拒 code=40400" "40400" "$(jget "$r" .code)"
r="$(req "$JAR_C" GET "/api/data?type=todo")"
expect "注销后读取接口不再放行" "40100" "$(jget "$r" .code)"

echo "==> 9. authLimiter 真会触发（连续打满后返回 HTTP 429）"
st=""
for _ in $(seq 1 12); do
  st="$(statusof "$JAR_B" POST "{\"username\":\"x\",\"password\":\"y\"}" /api/user/login)"
done
expect "限流命中时 HTTP 状态为 429" "429" "$st"

echo
echo "==> 结果：通过 $pass，失败 $fail"
if [ "$fail" -gt 0 ]; then
  echo "--- 服务端日志尾部 ---"; tail -20 "$LOG"
  exit 1
fi

# webCommand

极客风格的终端式浏览器主页：打开新标签页，用命令完成搜索、查询、待办、笔记等操作。
Nuxt 4 单体工程（SPA 前端 + Nitro 后端）+ MySQL，自建部署。

在线地址见 `NUXT_PUBLIC_SITE_URL`（默认 `https://command.zhangzhengyang.com`）。

## 来源与许可

本项目**不是完全原创**，是在他人实现基础上改造而来的衍生作品，代码中保留了原作者署名：

- 主体交互与多数命令实现来自 **YuIndex**（作者 `yupi`，21 个文件带 `@author yupi`）
- `curl` 命令移植自 **m4tt72** 的终端主页项目（5 个文件标 `@author m4tt72 (ported)`）
- 另有 2 个文件保留 `@author uiuing` 署名

本仓库自研的部分（云同步合并语义与墓碑、运行期配置注入、SQL 迁移器、分级配额与账号准入、
健康探活、测试底座与部署脚本等）以 [MIT License](./LICENSE) 发布。

**关于上游许可证**：分发时上游条款优先于本仓库的 MIT。上述三个上游项目的具体许可证
本仓库未逐一核实并存档，若其中存在比 MIT 更严格的条款（如要求同源许可证或强制保留声明），
应据其调整本仓库的许可与声明，不要以本文件为准。使用前请先核对上游。

## 目录结构

```
app/
  components/       终端 UI（Terminal.vue 为主组件）、命令面板、输出渲染
  core/
    commandRegister   命令清单（数组顺序 = help 展示顺序）
    commandExecutor   命令解析与执行（getopts 风格参数）
    commands/<功能>/  各命令实现；带 subCommands/ 的是父命令
  composables/      云同步（useCloudSync / cloudMerge / cloudSyncRegistry）
server/
  api/              REST 路由（/api/...）
  models/           Sequelize 模型（user、user_data）
  utils/            响应包装、限流、运行期配置、迁移、云数据类型
  plugins/          启动钩子：check-env（生产校验）、migrate（建表/迁移）
scripts/            本地质量门禁、部署、备份
test/               node:test 用例（*.spec.ts）
```

## 本地开发

前置：Node ≥ 22.18（跑测试需要原生类型剥离；本机实测 22.12 / 22.15 会报 `ERR_UNKNOWN_FILE_EXTENSION`，
24.21 可用）、pnpm、一个可连的 MySQL。

```bash
cp .env.example .env   # 填 DB_*，本地库可直接用 localhost/root
pnpm install
pnpm dev               # http://localhost:3000
```

常用命令：`pnpm dev` / `pnpm build` / `pnpm preview` / `pnpm lint` / `pnpm typecheck` / `pnpm test`。

## 环境变量（重要约束）

私有配置**只能在运行期注入**，不要往 `nuxt.config.ts` 的 `runtimeConfig` 里加 `process.env.X`：
`nuxt build` 会把这类值直接烘进 `.output`，构建产物本身就变成带凭证的对象。

服务端取值优先级由 `server/utils/appConfig.ts` 统一实现：

```
NUXT_DB_*  >  裸名 DB_*  >  构建期默认值
```

因此 `NUXT_DB_PASSWORD` 与 `DB_PASSWORD` 两种写法都生效，改 compose 的先后顺序不会把服务改崩；
改口令只需重启容器，不需要重新构建。`NUXT_TRUST_PROXY` 未打开时，限流会退化成按反代理的内层 IP
计数（所有访客共用一个桶），位于 Nginx/frp 之后部署时必须置为 `true`。

部署编排见 `docker-compose.example.yml`（复制为 `docker-compose.yml` 后填口令；真实编排文件已被
`.gitignore` 忽略）。

## 质量门禁

一条命令跑完格式、ESLint、类型、测试：

```bash
./scripts/check-all.sh
```

两套测试各管一段，`./scripts/check-all.sh` 会依次跑完：

- **`node --test "test/*.spec.ts"`**（`pnpm test`）：纯函数与静态契约，零第三方依赖。
  需要支持类型剥离的 Node（本机实测 24.21 可用；22.15 / 22.12 报 `ERR_UNKNOWN_FILE_EXTENSION`，
  22.18 是官方默认开启该特性的版本线，未在本机验证）。被测模块必须**自包含**——
  原生 ESM 不解析无扩展名的相对导入。
- **`vitest run`**（`pnpm test:routes`）：路由层。Nitro 会把 `defineEventHandler`、`readBody`、
  `getUserSession` 等注入成全局，普通 node 环境没有，所以由 `test/routes/nitroGlobals.ts`
  装替身，模型与服务用 `vi.mock` 替掉。
  **边界**：这套测试验证的是"路由拿到输入后做了什么判定"，不验证 h3 如何解析 HTTP body/query，
  也不连真实数据库（`userId` 归属、白名单、尺寸上限、限流响应码、会话清理都在这一层被钉住）。
  vitest 只收 `test/routes/**`，避免它去收集 `node:test` 用例造成"0 条却全绿"的假通过。

用例覆盖：云同步合并语义（逐条 last-write-wins、删除墓碑、保留窗口）、命令注册表契约
（未登记模块、命名/别名冲突、子命令 key 与其 `func` 一致、缺 `name`/`action`）、
前后端云数据类型白名单一致性、前后端口令下限一致性、运行期配置解析优先级、生产启动守卫、
云端数据准入（未登录 / type 越界 / 分级尺寸上限）、账号注销三条件、
数据库迁移器（幂等、水位、失败不登记），以及路由层的 `/api/data` 读写与 `/api/user/delete`
（伪造 userId 无效、限流返回 429/42900、删号后才清会话、删除失败时不清会话）。

## 云同步

登录后 `todo` / `space` / `note` / `custom` / `terminalConfig` / `theme` 六类数据可同步到云端，
唯一清单在 `app/composables/cloudSyncRegistry.ts`（页面加载、交互式登录、注销都遍历它；
新增 store 必须同时登记，且有契约测试兜底）。服务端白名单在 `server/utils/dataAccess.ts`，
两处不一致时测试会红。

合并语义：

- 每一类存成**一个 JSON blob**（`user_data` 表，`(userId, type)` 唯一）。单条上限按类型分级：
  数据类 `todo` / `space` / `note` 为 1MB，配置类 `custom` / `terminalConfig` / `theme` 为 64KB
  （配置正常只有几 KB，给到 1MB 等于没设限）。字节数按 UTF-8 计，不按字符数。
- 上传前**先拉取云端并合并**再写回，避免整包覆盖另一端的新增。
- 列表类数据按条目 `updateTime` 做 last-write-wins；删除写**墓碑**，保留 30 天，
  超过窗口的删除记录会被清理（此时另一端仍存在的同名条目可能被重新合并回来）。
- 配置类数据（主题 / 终端配置）按「整包较新者胜出」。
- `space` 的当前目录（cwd）属设备态，不参与同步。

## 部署与备份

传输与重建沿用 NAS 侧那套已验证管线（Mac 构建 → tar 管道同步 → NAS `docker compose --build`
→ frp → VPS Nginx），细节见《webCommand部署与避雷手册》§3。**仓库内的脚本不代做远端操作**，
只补最容易出事的环节：

```bash
./scripts/deploy.sh build   # 用 nvm 的 node 构建，并扫描 .output 是否含凭据（含则拒绝部署）
./scripts/deploy.sh verify  # 核验线上 /api/health
DB_HOST=... DB_USER=... DB_NAME=webCommand ./scripts/backup-db.sh   # 备份 + 空备份判定 + 保留窗口
```

两个不能省的坑：同步时必须补传 `.output/server/node_modules`（`bsdtar` 的
`--exclude=node_modules` 会把它一起排掉，缺了容器会因找不到 `mysql2` 崩溃循环）；
NAS 上构建要 `DOCKER_BUILDKIT=0`（btrfs + BuildKit 死锁）。

`/api/health` 在数据库不可达或表未就绪时返回 **503**，容器 healthcheck 依赖它，
避免出现"进程活着但注册登录全废"的假健康。部署后建议再确认一次生产库的
`(userId, type)` 唯一索引存在（`SHOW INDEX FROM user_data`）—— 迁移器对已存在的表是
完全不动的，而云端 upsert 的冲突判定依赖这个索引。

## 真实数据库冒烟

单元/路由测试都不碰数据库。要端到端验登录与云同步，用**本机隔离测试库**（绝不指生产）：

```bash
./scripts/init-test-db.sh                              # 生成 .env.test + scripts/init-test-db.sql（都是 0600 且 gitignore）
mysql -h 127.0.0.1 -u root -p < scripts/init-test-db.sql   # 唯一需要你手工执行的一步：建库 + 建只授权该库的账号
./scripts/smoke-cloud-sync.sh                          # 起 dev 指向 webcommand_test，跑 26 条断言
```

`smoke-cloud-sync.sh` 会先做一道**防误写生产库的闸门**：只有确认迁移器把 `user` / `user_data` 建在了
`webcommand_test` 里，才开始造数据（配置优先级若出错，应用会连到 `.env` 里的 NAS 库，而那边的
`/api/health` 同样会报 ok，光看健康检查发现不了）。

覆盖：迁移器在真实 MySQL 8 上建表、blob 逐字往返（含 4 字节 emoji，验 utf8mb4）、跨用户隔离、
`type` 白名单、按类型尺寸上限、匿名 40100、改密后旧密码失效与 8 位下限、注销三条件与注销后
不可再登录、authLimiter 触发时返回 HTTP 429。
不覆盖：客户端合并算法（写前合并 / 逐条 LWW / 墓碑），那部分由 `test/cloudMerge.spec.ts` 负责。

## 已知限制

- **单实例假设**：限流计数与找回密码验证码都存在进程内存，重启即失效，水平扩容前需改 Redis。
- 线上按 `webCommand` 库**全新开始**：前身工程的 `yuindex` 库未迁移，老账号与历史数据仍在旧库，
  需要时再自行导入。口令一律 bcrypt（早期为兼容旧库 MD5 哈希留的盐值路径已随该决定移除）。
- **SPA（`ssr: false`）**：面向终端交互与 localStorage；`app.head` 里的静态 meta / JSON-LD /
  `<noscript>` 兜底确实会出现在产物 HTML 外壳里（已实测），所以没有为了 SEO 上 SSR 的必要。
- 云端只按**类型**限额（见上），没有按用户的总容量配额；账号注销已有（`user delete`），
  但尚未提供"导出全部云端数据后删除"的一键流程。
- 无移动端适配（全仓无媒体查询），但 PWA manifest 声明了 `display: standalone`。
- 迁移器目前只覆盖 `user`、`user_data` 两张表；表结构变更需手写幂等 SQL 追加到
  `server/utils/migrations.ts`（已应用的迁移不会重跑）。
- `todo` 的初始列表为空（不再内置演示任务）。

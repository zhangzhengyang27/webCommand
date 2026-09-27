import type { RuntimeConfig } from 'nuxt/schema'

/**
 * 运行期配置解析：环境变量优先，构建期内联值只作最后兜底。
 *
 * 为什么要自己写这一层：Nitro 只把 `NUXT_` 前缀的环境变量映射进 runtimeConfig，
 * 而本项目的容器一直写的是裸名（DB_HOST / TRUST_PROXY 等），那些值在运行期根本不生效——
 * 服务用的是 `nuxt build` 时烘进 `.output` 的那一份配置。实测后果有两个：
 * 1. 改 compose 里的口令再重启也不会生效（产物里那份才是生效的），而产物本身就是带凭证的对象；
 * 2. `TRUST_PROXY` 失效 → `getClientIp()` 拿不到 x-forwarded-for，
 *    所有限流都按 frp/nginx 的内层 IP 计数，所有访客共用同一个桶。
 *
 * 这里同时接受 `NUXT_*` 与裸名两种写法，因此调整 compose 的先后顺序不会把线上服务改崩。
 * 本文件刻意不依赖其它模块（原生 ESM 不解析无扩展名的相对导入，单测要能直接跑）。
 */
export function setting(configured: unknown, ...envKeys: string[]): string {
  for (const key of envKeys) {
    const value = process.env[key]
    if (value !== undefined && value !== '') return value
  }
  return configured === undefined || configured === null ? '' : String(configured)
}

/** 布尔配置：'true' / '1' 视为真 */
export function boolSetting(configured: unknown, ...envKeys: string[]): boolean {
  const raw = setting(configured, ...envKeys)
  return raw === 'true' || raw === '1'
}

/** MySQL 连接参数（已解析完运行期覆盖） */
export interface DbConfig {
  host: string
  port: number
  name: string
  user: string
  password: string
}

/**
 * 解析数据库连接参数。
 *
 * 优先级：`NUXT_DB_*` > 裸名 `DB_*`（容器现有写法）> 构建期默认值。
 * nuxt.config 已不再把私有配置烘进产物，因此线上必须来自运行期环境变量。
 *
 * @param configured 显式传入时不读 runtimeConfig（便于单测）
 */
export function resolveDbConfig(configured?: Partial<RuntimeConfig>): DbConfig {
  const c = configured ?? useRuntimeConfig()
  return {
    host: setting(c.dbHost, 'NUXT_DB_HOST', 'DB_HOST'),
    port: Number(setting(c.dbPort, 'NUXT_DB_PORT', 'DB_PORT')) || 3306,
    name: setting(c.dbName, 'NUXT_DB_NAME', 'DB_NAME') || 'webCommand',
    user: setting(c.dbUser, 'NUXT_DB_USER', 'DB_USER'),
    password: setting(c.dbPassword, 'NUXT_DB_PASSWORD', 'DB_PASSWORD'),
  }
}

/** 生产环境缺必填项时列出变量名，避免只报一句「启动失败」要人猜 */
export function missingDbConfigKeys(config: DbConfig): string[] {
  const required: Array<[keyof DbConfig, string]> = [
    ['host', 'DB_HOST'],
    ['user', 'DB_USER'],
    ['password', 'DB_PASSWORD'],
  ]
  return required.filter(([key]) => !config[key]).map(([, name]) => name)
}

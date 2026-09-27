// 生产环境启动校验：数据库连接参数与会话密钥必须来自运行期环境变量。
// 数据库部分校验的是解析后的值（与真正建连用的是同一份），而不是 process.env——
// 之前读 process.env.DB_PASSWORD 而建连用构建期内联值，会出现「守卫通过但连的是另一份配置」。
// 会话密钥若短于 32 位，nuxt-auth-utils 会在每个用到 session 的请求里抛 500，
// 且错误信息不会提示是配置问题，所以必须在启动时就拦下。
// 构建期不校验，避免阻断 nuxt prepare/build。
import { missingDbConfigKeys, resolveDbConfig } from '../utils/appConfig'

/** nuxt-auth-utils 对会话密钥长度的硬性要求 */
const MIN_SESSION_PASSWORD_LENGTH = 32

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return
  const sessionPassword = process.env.NUXT_SESSION_PASSWORD ?? ''
  if (sessionPassword.length < MIN_SESSION_PASSWORD_LENGTH) {
    throw new Error(
      `[webcommand] 生产环境需要至少 ${MIN_SESSION_PASSWORD_LENGTH} 位的 NUXT_SESSION_PASSWORD` +
        `（当前 ${sessionPassword.length} 位），否则所有登录态接口都会返回 500`,
    )
  }
  const config = resolveDbConfig()
  const missing = missingDbConfigKeys(config)
  if (missing.length) {
    throw new Error(
      `[webcommand] 生产环境缺少数据库配置：${missing.join(' / ')}（推荐用 NUXT_DB_* 写法，裸名 DB_* 也接受）`,
    )
  }
  // host/user 在非生产有 localhost/root 这类开发默认值，生产必须显式给出，
  // 否则会静默去连容器内的 localhost，报错发生在第一次查询而不是启动时，很难定位
  if (!process.env.NUXT_DB_HOST && !process.env.DB_HOST) {
    throw new Error('[webcommand] 生产环境必须显式提供 DB_HOST（默认值 localhost 仅供本地开发）')
  }
  if (config.password === 'root1234') {
    throw new Error('[webcommand] 生产环境不得使用默认开发口令 root1234，请显式配置 DB_PASSWORD')
  }
})

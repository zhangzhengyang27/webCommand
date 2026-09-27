import { appStatus } from '../utils/appStatus'
import { useDb } from '../utils/db'

/** 应用真正依赖的表；缺任何一张都意味着注册/登录不可用 */
const REQUIRED_TABLES = ['user', 'user_data']

/** 表名写死在常量里（不接收任何外部输入），避免拼接 SQL */
const EXISTING_TABLES_SQL =
  `SELECT TABLE_NAME AS name FROM information_schema.TABLES ` +
  `WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('user', 'user_data')`

/** 探活真正关心的两件事：库连不连得上、依赖的表在不在 */
async function inspectDb(): Promise<{ dbReachable: boolean; missingTables: string[] }> {
  try {
    const sequelize = useDb()
    await sequelize.query('SELECT 1')
    const [rows] = (await sequelize.query(EXISTING_TABLES_SQL)) as [
      Array<{ name?: string; TABLE_NAME?: string }>,
      unknown,
    ]
    const found = new Set(rows.map((r) => r.name ?? r.TABLE_NAME))
    return { dbReachable: true, missingTables: REQUIRED_TABLES.filter((t) => !found.has(t)) }
  } catch {
    return { dbReachable: false, missingTables: [...REQUIRED_TABLES] }
  }
}

/**
 * 健康检查：供容器探活与部署脚本判断"真的起来了"。
 * 结构未就绪或数据库不可用时返回 503，避免"进程活着但注册登录全废"的假健康。
 *
 * 就绪状态按需查 information_schema，不读迁移插件写的内存标志：
 * Nitro 在 dev 下会重复实例化模块，那个标志可能停在 false（实测就是这样误报的）；
 * 而探活一旦误判就会让容器反复重启。查库多一条 SQL，换来的是"报告的就是事实"。
 */
export default defineEventHandler(async (event) => {
  const { dbReachable, missingTables } = await inspectDb()
  const healthy = dbReachable && missingTables.length === 0
  if (!healthy) setResponseStatus(event, 503)
  return {
    code: healthy ? 0 : 50000,
    data: {
      status: healthy ? 'ok' : 'degraded',
      service: 'webcommand-nuxt',
      time: new Date().toISOString(),
      dbReachable,
      schemaReady: healthy,
      missingTables: missingTables.length ? missingTables : undefined,
      // 迁移失败的具体原因仍然暴露，供排障用
      schemaError: appStatus.schemaError || undefined,
    },
  }
})

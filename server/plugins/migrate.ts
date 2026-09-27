import { useDb } from '../utils/db'
import { runMigrations, type MigrationRunner } from '../utils/migrations'
import { setSchemaStatus } from '../utils/appStatus'

/**
 * 启动时执行数据库迁移。
 *
 * 不阻断启动：数据库瞬时不可用时若直接抛错，容器会进入重启风暴；
 * 失败状态改由 /api/health 暴露（schemaReady=false），让探活和告警去发现。
 */
export default defineNitroPlugin(async () => {
  try {
    const sequelize = useDb()
    const runner: MigrationRunner = {
      async query(sql: string) {
        const [rows] = await sequelize.query(sql)
        return rows
      },
    }
    const { applied, skipped } = await runMigrations(runner)
    setSchemaStatus(true)
    if (applied.length) console.log('[migrate] 已应用迁移：', applied.join(', '))
    else console.log('[migrate] 数据库结构已是最新（跳过 %d 条）', skipped.length)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    setSchemaStatus(false, message)
    console.error('[migrate] 数据库迁移失败，注册/登录可能不可用：', message)
  }
})

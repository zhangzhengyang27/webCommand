import { Sequelize } from 'sequelize'
import { resolveDbConfig } from './appConfig'

let sequelize: Sequelize | null = null

/**
 * Sequelize 单例。
 * 懒加载，避免在 Nitro 运行时配置就绪前实例化。
 */
export function useDb(): Sequelize {
  if (sequelize) return sequelize
  const db = resolveDbConfig()
  sequelize = new Sequelize(db.name, db.user, db.password, {
    host: db.host,
    port: db.port,
    dialect: 'mysql',
    logging: false,
  })
  sequelize
    .authenticate()
    .then(() => console.log('MySQL client connected'))
    .catch((e) => console.error('Unable to connect to MySQL:', e?.message || e))
  return sequelize
}

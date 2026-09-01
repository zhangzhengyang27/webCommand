import { Sequelize } from 'sequelize'

let sequelize: Sequelize | null = null

/**
 * Sequelize 单例（对齐原 server/db.js）。
 * 懒加载，避免在 Nitro 运行时配置就绪前实例化。
 */
export function useDb(): Sequelize {
  if (sequelize) return sequelize
  const c = useRuntimeConfig()
  sequelize = new Sequelize(c.dbName, c.dbUser, c.dbPassword, {
    host: c.dbHost,
    port: Number(c.dbPort),
    dialect: 'mysql',
    logging: false,
  })
  sequelize
    .authenticate()
    .then(() => console.log('MySQL client connected'))
    .catch((e) => console.error('Unable to connect to MySQL:', e?.message || e))
  return sequelize
}

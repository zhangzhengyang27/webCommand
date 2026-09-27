/**
 * 极简 SQL 迁移器（不引外部依赖，避免动 node_modules）
 *
 * 为什么需要它：原先只有 user_data 走 `sequelize.sync()`，`user` 表的结构完全不在代码里
 * （只存在于旧库）。换库或灾备恢复时表建不出来，注册/登录直接失败，且没人能从仓库重建。
 * 迁移语句必须是显式 SQL 并随代码入库，而不是依赖 sync() 的隐式推导。
 *
 * 约定：
 * - 每条迁移用唯一 id 标识，按 id 升序执行；已执行过的记录在 schema_migrations 表里，不会重复跑。
 * - 全部语句必须幂等（CREATE TABLE IF NOT EXISTS 等），因为线上库里表可能已经存在。
 */

export interface Migration {
  id: string
  statements: string[]
}

/** 与被 sequelize 定义的表保持一致的 DDL */
export const MIGRATIONS: Migration[] = [
  {
    id: '0001_init_user_and_user_data',
    statements: [
      `CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`username\` VARCHAR(255) NOT NULL,
        \`password\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(255) NULL,
        \`status\` INT NOT NULL DEFAULT 0,
        \`createTime\` DATETIME NULL,
        \`updateTime\` DATETIME NULL,
        \`isDelete\` INT NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`user_username_unique\` (\`username\`),
        UNIQUE KEY \`user_email_unique\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`user_data\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`userId\` BIGINT NOT NULL,
        \`type\` VARCHAR(32) NOT NULL,
        \`content\` MEDIUMTEXT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`user_data_userId_type_unique\` (\`userId\`, \`type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ],
  },
]

/** 记录已应用迁移的水位表 */
const MIGRATIONS_TABLE = 'schema_migrations'

export function migrationsTableDdl(): string {
  return `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`appliedAt\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
}

/** 只要能被迁移器调用到的最小连接面，便于单测替换 */
export interface MigrationRunner {
  query: (sql: string) => Promise<unknown>
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

/** 读取已应用的迁移 id */
async function appliedIds(runner: MigrationRunner): Promise<Set<string>> {
  const rows = (await runner.query(`SELECT \`id\` FROM \`${MIGRATIONS_TABLE}\``)) as Array<
    { id?: string | number } | string | number
  >
  const ids = new Set<string>()
  for (const row of rows ?? []) {
    const value = typeof row === 'object' && row !== null ? row.id : row
    if (value !== undefined && value !== null) ids.add(String(value))
  }
  return ids
}

/**
 * 按序执行未应用的迁移。
 *
 * @throws 迁移语句本身失败时抛出（调用方决定是否阻断启动）；失败的迁移不会被记录，下次启动会重试
 */
export async function runMigrations(
  runner: MigrationRunner,
  migrations: Migration[] = MIGRATIONS,
): Promise<MigrationResult> {
  await runner.query(migrationsTableDdl())
  const done = await appliedIds(runner)
  const applied: string[] = []
  const skipped: string[] = []
  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (done.has(migration.id)) {
      skipped.push(migration.id)
      continue
    }
    for (const statement of migration.statements) await runner.query(statement)
    await runner.query(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (\`id\`, \`appliedAt\`) VALUES (${escapeSql(
        migration.id,
      )}, CURRENT_TIMESTAMP)`,
    )
    applied.push(migration.id)
  }
  return { applied, skipped }
}

/** 迁移 id 来自代码常量，这里只做字面量转义，不接受外部输入 */
function escapeSql(value: string): string {
  return `'${value.replace(/[\\']/g, '\\$&')}'`
}

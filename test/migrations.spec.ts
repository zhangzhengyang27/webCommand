import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIGRATIONS,
  migrationsTableDdl,
  runMigrations,
  type MigrationRunner,
} from '../server/utils/migrations.ts'

/** 假连接：记录执行过的语句，并可按需让某条语句失败 */
function fakeRunner(options: { existing?: string[]; failOn?: (sql: string) => boolean } = {}) {
  const executed: string[] = []
  const applied = new Set(options.existing ?? [])
  const runner: MigrationRunner = {
    async query(sql: string) {
      executed.push(sql)
      if (options.failOn?.(sql)) throw new Error(`boom: ${sql.slice(0, 40)}`)
      if (/^SELECT/.test(sql)) return [...applied].map((id) => ({ id }))
      const insert = sql.match(
        /INSERT INTO `schema_migrations` \(`id`, `appliedAt`\) VALUES \('([^']+)'/,
      )
      if (insert) applied.add(insert[1]!)
      return undefined
    },
  }
  return { runner, executed, applied }
}

describe('数据库迁移器', () => {
  test('每条 DDL 都必须幂等（线上表可能已经存在）', () => {
    const statements = MIGRATIONS.flatMap((m) => m.statements)
    assert.ok(statements.length >= 2)
    for (const sql of statements) {
      assert.match(
        sql,
        /CREATE TABLE IF NOT EXISTS/,
        `迁移语句缺少 IF NOT EXISTS：${sql.slice(0, 60)}`,
      )
    }
  })

  test('每个模型用到的表都必须被建出来（否则换库/灾备后注册登录直接失败）', () => {
    const created = MIGRATIONS.flatMap((m) => m.statements).join('\n')
    for (const table of ['`user`', '`user_data`']) {
      assert.ok(created.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `缺少 ${table} 的建表语句`)
    }
  })

  test('云同步类型有唯一键，同一用户同一类型只有一行', () => {
    const userData = MIGRATIONS.flatMap((m) => m.statements).find((s) => s.includes('`user_data`'))
    assert.match(userData!, /UNIQUE KEY[^)]*\(`userId`, `type`\)/)
  })

  test('首次启动：水位表自建 + 全部迁移按序应用并登记', async () => {
    const { runner, executed, applied } = fakeRunner()
    const result = await runMigrations(runner)
    assert.deepEqual(
      result.applied,
      [...MIGRATIONS].map((m) => m.id),
    )
    assert.equal(result.skipped.length, 0)
    assert.match(executed[0]!, /CREATE TABLE IF NOT EXISTS `schema_migrations`/)
    for (const migration of MIGRATIONS) assert.ok(applied.has(migration.id))
  })

  test('重复启动：已应用的迁移不再执行（幂等）', async () => {
    const existing = MIGRATIONS.map((m) => m.id)
    const { runner, executed } = fakeRunner({ existing })
    const result = await runMigrations(runner)
    assert.equal(result.applied.length, 0)
    assert.deepEqual(result.skipped.sort(), [...existing].sort())
    // 除了建水位表与查询，不应再出现任何 DDL
    assert.deepEqual(
      executed.filter((sql) => /^(CREATE|ALTER|INSERT)/.test(sql)),
      [migrationsTableDdl()],
    )
  })

  test('迁移失败时不得登记为已应用（否则坏结构会被永久跳过）', async () => {
    const { runner, applied } = fakeRunner({ failOn: (sql) => sql.includes('`user_data`') })
    await assert.rejects(() => runMigrations(runner))
    assert.equal(applied.has('0001_init_user_and_user_data'), false)
  })

  test('新增迁移时按 id 升序执行，老迁移不会重跑', async () => {
    const { runner, applied } = fakeRunner({ existing: ['0001_init_user_and_user_data'] })
    const result = await runMigrations(runner, [
      { id: '0002_add_index', statements: ['CREATE TABLE IF NOT EXISTS `t2` (a INT)'] },
      { id: '0001_init_user_and_user_data', statements: ['SELECT 1'] },
    ])
    assert.deepEqual(result.applied, ['0002_add_index'])
    assert.equal(applied.has('0002_add_index'), true)
  })
})

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkDataRead,
  checkDataWrite,
  isAllowedDataType,
  contentLimitFor,
  MAX_DATA_CONTENT_BYTES,
  MAX_CONFIG_CONTENT_BYTES,
  CLOUD_DATA_TYPES,
} from '../server/utils/dataAccess.ts'

const USER = { id: 7 }

describe('云端数据接口准入', () => {
  test('未登录一律拒绝，且返回 NO_AUTH（数据按 userId 分片，匿名访问等于串数据）', () => {
    for (const user of [undefined, null, {}, { id: 0 }, { id: null }]) {
      const decision = checkDataRead(user, 'todo')
      assert.equal(decision.ok, false, `用户 ${JSON.stringify(user)} 不应放行`)
      assert.equal(decision.code, 'NO_AUTH')
    }
  })

  test('type 白名单外的取值全部拒绝', () => {
    for (const type of ['', 'users', 'ToDo', 'todo ', '../x', 'role', undefined, 42, {}, []]) {
      assert.equal(isAllowedDataType(type), false, `${JSON.stringify(type)} 不应被放行`)
    }
    for (const type of CLOUD_DATA_TYPES) assert.equal(isAllowedDataType(type), true)
  })

  test('放行时把生效的 userId / type 交回路由，避免把 undefined 当查询条件', () => {
    const decision = checkDataRead(USER, 'space')
    assert.equal(decision.ok, true)
    if (decision.ok) {
      assert.equal(decision.userId, 7)
      assert.equal(decision.type, 'space')
    }
  })

  test('数据类（todo/space/note）上限 1MB，边界要精确', () => {
    assert.equal(checkDataWrite(USER, 'todo', undefined).ok, false)
    assert.equal(checkDataWrite(USER, 'todo', { a: 1 }).ok, false)
    assert.equal(checkDataWrite(USER, 'todo', '[]').ok, true)
    // 刚好到上限放行，多一个字节才拒绝
    assert.equal(checkDataWrite(USER, 'todo', 'a'.repeat(MAX_DATA_CONTENT_BYTES)).ok, true)
    const decision = checkDataWrite(USER, 'todo', 'a'.repeat(MAX_DATA_CONTENT_BYTES + 1))
    assert.equal(decision.ok, false)
    assert.equal(decision.code, 'PARAMS')
  })

  test('配置类（custom/terminalConfig/theme）走 64KB 限额，不能当大对象存储灌', () => {
    for (const type of ['custom', 'terminalConfig', 'theme'] as const) {
      assert.equal(contentLimitFor(type), MAX_CONFIG_CONTENT_BYTES)
      assert.equal(checkDataWrite(USER, type, 'a'.repeat(MAX_CONFIG_CONTENT_BYTES)).ok, true)
      const decision = checkDataWrite(USER, type, 'a'.repeat(MAX_CONFIG_CONTENT_BYTES + 1))
      assert.equal(decision.ok, false, `${type} 超过配置类上限应拒绝`)
      assert.equal(decision.code, 'PARAMS')
    }
    for (const type of ['todo', 'space', 'note'] as const) {
      assert.equal(contentLimitFor(type), MAX_DATA_CONTENT_BYTES)
    }
  })

  test('字节数按 UTF-8 计算，不能按字符数放行', () => {
    // 每个汉字占 3 字节：字符数还没到上限，字节数已经越界
    const text = '中'.repeat(Math.floor((MAX_CONFIG_CONTENT_BYTES * 4) / 3 / 100) * 100)
    assert.ok(Buffer.byteLength(text, 'utf8') > MAX_CONFIG_CONTENT_BYTES)
    assert.equal(checkDataWrite(USER, 'theme', text).ok, false)
    // 同一串内容对 1MB 的数据类是合法的，说明限额确实按类型走
    assert.equal(checkDataWrite(USER, 'note', text).ok, true)
  })

  test('写入时未登录优先于参数错误（不泄露 type 是否有效）', () => {
    const decision = checkDataWrite(undefined, '不存在的类型', 'x')
    assert.equal(decision.ok, false)
    assert.equal(decision.code, 'NO_AUTH')
  })
})

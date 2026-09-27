import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
  checkAccountDeletion,
  isValidEmail,
} from '../server/utils/accountPolicy.ts'

const ROOT = new URL('..', import.meta.url).pathname
const USER = { id: 7, username: 'grace' }

describe('口令长度策略', () => {
  test('短于下限的口令被拒绝，达到下限的放行', () => {
    assert.equal(
      validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1)),
      `密码至少 ${MIN_PASSWORD_LENGTH} 位`,
    )
    assert.equal(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH)), null)
    assert.equal(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH + 8)), null)
  })

  test('空值与非字符串一律拒绝（不能把 undefined 直接比长度）', () => {
    for (const bad of [undefined, null, '', 12345678, {}, []]) {
      assert.notEqual(validateNewPassword(bad), null, `${JSON.stringify(bad)} 不应通过`)
    }
  })

  test('前端提示与后端校验用的是同一个数字', () => {
    // 前端拿不到 server/ 模块，只能各自声明一遍常量值，
    // 因此这里比对两处源码里的数字，防止只改一边导致提示与校验脱节
    const client = readFileSync(join(ROOT, 'app/core/commands/user/userConstant.ts'), 'utf8').match(
      /MIN_PASSWORD_LENGTH = (\d+)/,
    )?.[1]
    const server = readFileSync(join(ROOT, 'server/utils/accountPolicy.ts'), 'utf8').match(
      /MIN_PASSWORD_LENGTH = (\d+)/,
    )?.[1]
    assert.ok(client, '前端未找到 MIN_PASSWORD_LENGTH')
    assert.ok(server, '后端未找到 MIN_PASSWORD_LENGTH')
    assert.equal(client, server)
    assert.equal(Number(server), MIN_PASSWORD_LENGTH)
  })
})

describe('邮箱格式校验', () => {
  test('放行含 . _ + % 与中文本地部分的合法地址（旧正则会把它们误杀）', () => {
    for (const good of [
      'grace@example.com',
      'first.last@gmail.com',
      'tag+promo@gmail.com',
      'my_name@corp.co',
      'a%b@sub.domain.org',
      '中文名@domain.cn',
      'user1@localhost.dev',
    ]) {
      assert.equal(isValidEmail(good), true, `${good} 应当合法`)
    }
  })

  test('拒绝缺 @、多 @、无后缀、非字符串与超长地址', () => {
    for (const bad of [
      '',
      'plain',
      '@example.com',
      'a@b',
      'a@@b.com',
      'a@.com',
      'a b@c.com',
      42,
      null,
      undefined,
    ]) {
      assert.equal(isValidEmail(bad), false, `${JSON.stringify(bad)} 应当被拒`)
    }
    assert.equal(isValidEmail(`${'a'.repeat(250)}@example.com`), false)
  })
})

describe('账号注销判定', () => {
  test('未登录不得注销（含缺 username 的会话）', () => {
    for (const user of [undefined, null, {}, { id: 7 }, { username: 'grace' }]) {
      const decision = checkAccountDeletion(user, 'grace', 'pw')
      assert.equal(decision.ok, false, `会话 ${JSON.stringify(user)} 不应放行`)
      assert.equal(decision.code, 'NO_AUTH')
    }
  })

  test('必须重新提供密码', () => {
    for (const bad of [undefined, '', 123]) {
      const decision = checkAccountDeletion(USER, 'grace', bad)
      assert.equal(decision.ok, false)
      assert.equal(decision.code, 'PARAMS')
    }
  })

  test('确认串必须与用户名完全一致，不做大小写或 trim 宽松处理', () => {
    for (const wrong of ['Grace', 'grace ', ' grace', 'grac', '']) {
      const decision = checkAccountDeletion(USER, wrong, 'pw')
      assert.equal(decision.ok, false, `确认串 "${wrong}" 不应放行`)
      assert.equal(decision.code, 'PARAMS')
    }
  })

  test('提示里带上应当输入的确认串（用户不必翻文档就知道怎么补）', () => {
    const decision = checkAccountDeletion(USER, undefined, 'pw')
    assert.equal(decision.ok, false)
    if (!decision.ok) assert.match(decision.message, /--confirm grace/)
  })

  test('三件齐全时交回生效的 userId', () => {
    const decision = checkAccountDeletion(USER, 'grace', 'correct horse battery staple')
    assert.equal(decision.ok, true)
    if (decision.ok) assert.equal(decision.userId, 7)
  })
})

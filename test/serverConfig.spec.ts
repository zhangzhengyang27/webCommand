import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  setting,
  boolSetting,
  resolveDbConfig,
  missingDbConfigKeys,
} from '../server/utils/appConfig.ts'

/** 这些用例要改 process.env，跑完必须还原，否则会污染同进程里的其它用例 */
const WATCHED = [
  'NUXT_DB_HOST',
  'DB_HOST',
  'NUXT_DB_PORT',
  'DB_PORT',
  'NUXT_DB_USER',
  'DB_USER',
  'NUXT_DB_PASSWORD',
  'DB_PASSWORD',
  'TRUST_PROXY',
  'NUXT_TRUST_PROXY',
] as const

let snapshot: Record<string, string | undefined> = {}
beforeEach(() => {
  snapshot = {}
  for (const key of WATCHED) snapshot[key] = process.env[key]
})
afterEach(() => {
  for (const key of WATCHED) {
    const value = snapshot[key]
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
})

describe('setting：运行期环境变量优先于构建期内联值', () => {
  test('环境变量覆盖烘进产物的值', () => {
    process.env.DB_HOST = 'runtime-host'
    assert.equal(setting('baked-host', 'NUXT_DB_HOST', 'DB_HOST'), 'runtime-host')
  })

  test('NUXT_ 前缀优先于裸名', () => {
    process.env.DB_HOST = 'plain-host'
    process.env.NUXT_DB_HOST = 'nuxt-host'
    assert.equal(setting('', 'NUXT_DB_HOST', 'DB_HOST'), 'nuxt-host')
  })

  test('空字符串视为未配置，不会把兜底值吃掉', () => {
    process.env.DB_HOST = ''
    assert.equal(setting('baked-host', 'NUXT_DB_HOST', 'DB_HOST'), 'baked-host')
  })

  test('都没有配置时返回空串而不是 undefined/null 字面量', () => {
    assert.equal(setting(undefined, 'NUXT_DB_HOST'), '')
    assert.equal(setting(null, 'NUXT_DB_HOST'), '')
    assert.equal(setting(3306, 'NUXT_DB_PORT'), '3306')
  })
})

describe('boolSetting：TRUST_PROXY 的历史写法必须仍然生效', () => {
  test('容器里只写裸名 TRUST_PROXY=true 时也算开启', () => {
    process.env.TRUST_PROXY = 'true'
    // 构建期内联值是 false：曾经因为只读 runtimeConfig 而导致限流按代理 IP 计数
    assert.equal(boolSetting(false, 'NUXT_TRUST_PROXY', 'TRUST_PROXY'), true)
  })

  test('未配置或写 false 时为关闭', () => {
    assert.equal(boolSetting(false, 'NUXT_TRUST_PROXY', 'TRUST_PROXY'), false)
    process.env.TRUST_PROXY = 'false'
    assert.equal(boolSetting(false, 'NUXT_TRUST_PROXY', 'TRUST_PROXY'), false)
  })
})

describe('resolveDbConfig：建连参数解析', () => {
  test('构建期默认值不再携带凭据，口令必须来自运行期', () => {
    const empty = { dbHost: '', dbPort: 0, dbName: '', dbUser: '', dbPassword: '' }
    assert.deepEqual(missingDbConfigKeys(resolveDbConfig(empty)), [
      'DB_HOST',
      'DB_USER',
      'DB_PASSWORD',
    ])
  })

  test('裸名环境变量可以补全全部必填项', () => {
    process.env.DB_HOST = 'dev-mysql'
    process.env.DB_USER = 'appuser'
    process.env.DB_PASSWORD = 'a-strong-one'
    const resolved = resolveDbConfig({ dbHost: '', dbUser: '', dbPassword: '' })
    assert.deepEqual(missingDbConfigKeys(resolved), [])
    assert.equal(resolved.host, 'dev-mysql')
    assert.equal(resolved.port, 3306)
    assert.equal(resolved.name, 'webCommand')
  })

  test('换口令后无需重新构建：运行期值覆盖旧的内联值', () => {
    process.env.NUXT_DB_PASSWORD = 'rotated'
    const resolved = resolveDbConfig({
      dbHost: 'h',
      dbUser: 'u',
      dbPassword: 'stale-baked',
    })
    assert.equal(resolved.password, 'rotated')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent, observe, sessionTracker, type RouteHandler } from './nitroGlobals'

const userDataMock = vi.hoisted(() => ({
  upsert: vi.fn(async () => undefined),
  findOne: vi.fn(async () => null),
}))

vi.mock('../../server/models/UserData', () => ({ UserDataModel: () => userDataMock }))

// 必须在 vi.mock 之后静态导入，才能拿到被替换过的模型
const dataReadHandler = (await import('../../server/api/data/index.get')).default
const dataSyncHandler = (await import('../../server/api/data/sync.post')).default

const callDataRead = dataReadHandler as unknown as RouteHandler
const callDataSync = dataSyncHandler as unknown as RouteHandler

const SESSION = { id: 7, username: 'grace' }

interface Envelope {
  code: number
  message?: string
  data?: unknown
}

beforeEach(() => {
  userDataMock.upsert.mockClear()
  userDataMock.findOne.mockClear()
  userDataMock.findOne.mockResolvedValue(null)
})

/**
 * /api/data 与 /api/data/sync 的行为契约。
 * 重点是安全边界：匿名访问、type 白名单、按类型尺寸上限，
 * 以及最要命的一条——落库的 userId 必须来自会话，不能来自请求体。
 */
describe('云端数据接口', () => {
  it('匿名读取被拒（40100）且不落到模型', async () => {
    const event = makeEvent({ query: { type: 'todo' } })
    const body = (await callDataRead(event)) as Envelope
    expect(body.code).toBe(40100)
    expect(userDataMock.findOne).not.toHaveBeenCalled()
  })

  it('匿名写入被拒（40100）且不落库', async () => {
    const event = makeEvent({ body: { type: 'todo', content: '[]' } })
    const body = (await callDataSync(event)) as Envelope
    expect(body.code).toBe(40100)
    expect(userDataMock.upsert).not.toHaveBeenCalled()
  })

  it('白名单外的 type 一律拒绝，含自造类型与大小写/空格伪装', async () => {
    for (const type of ['role', 'admin', 'todo ', 'TODO', '', 'x'.repeat(40)]) {
      const event = makeEvent({ sessionUser: SESSION, query: { type } })
      const body = (await callDataRead(event)) as Envelope
      expect(body.code, `type=${JSON.stringify(type)} 应被拒`).toBe(40000)
    }
    expect(userDataMock.findOne).not.toHaveBeenCalled()
  })

  it('写入的 userId 取自会话，请求体里伪造 userId 无效', async () => {
    const event = makeEvent({
      sessionUser: SESSION,
      body: { type: 'todo', content: '[]', userId: 999 },
    })
    const body = (await callDataSync(event)) as Envelope
    expect(body.code).toBe(0)
    expect(userDataMock.upsert).toHaveBeenCalledTimes(1)
    const arg = userDataMock.upsert.mock.calls[0]![0] as { userId: number; type: string }
    expect(arg.userId).toBe(7)
    expect(arg.type).toBe('todo')
  })

  it('数据类容忍到 1MB，配置类超过 64KB 即拒', async () => {
    const okBig = (await callDataSync(
      makeEvent({ sessionUser: SESSION, body: { type: 'todo', content: 'a'.repeat(1024 * 1024) } }),
    )) as Envelope
    expect(okBig.code).toBe(0)

    const rejected = (await callDataSync(
      makeEvent({
        sessionUser: SESSION,
        body: { type: 'theme', content: 'a'.repeat(64 * 1024 + 1) },
      }),
    )) as Envelope
    expect(rejected.code).toBe(40000)
    expect(rejected.message).toContain('65536')
    // 超限那次不应落库
    expect(userDataMock.upsert).toHaveBeenCalledTimes(1)
  })

  it('非字符串 content 与缺字段一律拒绝', async () => {
    for (const content of [undefined, null, 42, { a: 1 }, ['x']]) {
      const body = (await callDataSync(
        makeEvent({ sessionUser: SESSION, body: { type: 'note', content } }),
      )) as Envelope
      expect(body.code, `content=${JSON.stringify(content)} 应被拒`).toBe(40000)
    }
    expect(userDataMock.upsert).not.toHaveBeenCalled()
  })

  it('读取命中原样返回云端 blob', async () => {
    const blob = '{"items":[{"id":"a"}],"deleted":{}}'
    userDataMock.findOne.mockResolvedValueOnce({ getDataValue: () => blob })
    const body = (await callDataRead(
      makeEvent({ sessionUser: SESSION, query: { type: 'todo' } }),
    )) as Envelope
    expect(body.code).toBe(0)
    expect(body.data).toBe(blob)
  })

  it('同一 IP 打满配额后返回 42900，其他 IP 不受牵连', async () => {
    const crowded = '198.51.100.9'
    let last: Envelope = { code: 0 }
    // 限流窗口是每 IP 每分钟 120 次，多打一次即触发
    for (let i = 0; i < 121; i++) {
      last = (await callDataRead(
        makeEvent({ sessionUser: SESSION, query: { type: 'todo' }, ip: crowded }),
      )) as Envelope
    }
    expect(last.code).toBe(42900)
    const untouched = (await callDataRead(
      makeEvent({ sessionUser: SESSION, query: { type: 'todo' }, ip: '198.51.100.10' }),
    )) as Envelope
    expect(untouched.code).toBe(0)
  })

  it('限流命中时 HTTP 状态是 429，而不是包装成 200', async () => {
    const ip = '198.51.100.11'
    let event = makeEvent({ sessionUser: SESSION, query: { type: 'todo' }, ip })
    for (let i = 0; i < 121; i++) {
      event = makeEvent({ sessionUser: SESSION, query: { type: 'todo' }, ip })
      await callDataRead(event)
    }
    expect(observe(event).status).toBe(429)
  })

  it('读取接口不碰会话', async () => {
    const before = sessionTracker.clears
    await callDataRead(makeEvent({ sessionUser: SESSION, query: { type: 'todo' } }))
    expect(sessionTracker.clears).toBe(before)
  })
})

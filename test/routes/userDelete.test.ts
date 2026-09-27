import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent, observe, sessionTracker, type RouteHandler } from './nitroGlobals'

const accountMock = vi.hoisted(() => ({
  deleteAccount: vi.fn(async () => true),
}))

vi.mock('../../server/services/userService', () => accountMock)

const deleteHandler = (await import('../../server/api/user/delete.post')).default
const callDelete = deleteHandler as unknown as RouteHandler

const SESSION = { id: 7, username: 'grace' }

interface Envelope {
  code: number
  message?: string
}

beforeEach(() => {
  accountMock.deleteAccount.mockClear()
})

/**
 * 注销账号接口。这里最容易写错的是"确认"的强度：
 * 只靠登录态不足以证明用户真想删号，所以口令与确认串都必须严格匹配，
 * 而且这些检查必须发生在真正删数据之前。
 */
describe('账号注销接口', () => {
  it('匿名请求返回 40100 且不进删除逻辑', async () => {
    const body = (await callDelete(
      makeEvent({ body: { password: 'p', confirm: 'grace' } }),
    )) as Envelope
    expect(body.code).toBe(40100)
    expect(accountMock.deleteAccount).not.toHaveBeenCalled()
  })

  it('缺少确认串时只提示怎么补，不删任何东西', async () => {
    const body = (await callDelete(
      makeEvent({ sessionUser: SESSION, body: { password: 'p' } }),
    )) as Envelope
    expect(body.code).toBe(40000)
    expect(body.message).toContain('--confirm grace')
    expect(accountMock.deleteAccount).not.toHaveBeenCalled()
  })

  it('确认串大小写不一致也拒绝（用户名区分大小写）', async () => {
    for (const confirm of ['Grace', 'grace ', 'grac']) {
      const body = (await callDelete(
        makeEvent({ sessionUser: SESSION, body: { password: 'p', confirm } }),
      )) as Envelope
      expect(body.code, `confirm=${JSON.stringify(confirm)} 应被拒`).toBe(40000)
    }
    expect(accountMock.deleteAccount).not.toHaveBeenCalled()
  })

  it('不重新输密码就不能删号（会话被借用时也不该能删）', async () => {
    for (const password of ['', undefined, 12345678]) {
      const body = (await callDelete(
        makeEvent({ sessionUser: SESSION, body: { password, confirm: 'grace' } }),
      )) as Envelope
      expect(body.code, `password=${JSON.stringify(password)} 应被拒`).toBe(40000)
    }
    expect(accountMock.deleteAccount).not.toHaveBeenCalled()
  })

  it('条件齐全时按会话 userId 删除，并清掉会话', async () => {
    const before = sessionTracker.clears
    const event = makeEvent({
      sessionUser: SESSION,
      body: { password: 'sup3rsecret', confirm: 'grace' },
    })
    const body = (await callDelete(event)) as Envelope
    expect(body.code).toBe(0)
    expect(accountMock.deleteAccount).toHaveBeenCalledWith(7, 'sup3rsecret')
    expect(sessionTracker.clears).toBe(before + 1)
    expect(observe(event).sessionUser).toBe(null)
  })

  it('删除失败时不清会话（避免"数据还在但用户被登出"的误导状态）', async () => {
    accountMock.deleteAccount.mockRejectedValueOnce(new Error('db down'))
    // bizHandler 会把非业务异常打到 console.error，这条用例故意走失败路径，把噪音抑制掉
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = sessionTracker.clears
    const event = makeEvent({ sessionUser: SESSION, body: { password: 'p', confirm: 'grace' } })
    const body = (await callDelete(event)) as Envelope
    expect(body.code).toBe(50000)
    expect(sessionTracker.clears).toBe(before)
    expect(observe(event).sessionUser).toEqual(SESSION)
    errorLog.mockRestore()
  })
})

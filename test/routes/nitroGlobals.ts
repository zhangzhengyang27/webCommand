/**
 * Nitro 运行期会把这些函数注入成全局，node/vitest 里没有，所以在 setup 里装替身。
 *
 * 边界要说清楚：这里**不**验证 h3 怎么解析 body/query（那是 h3 的事），
 * 验证的是我们的路由在拿到输入后做了什么判定——登录态、type 白名单、尺寸上限、
 * userId 归属、限流响应码、注销后会话有没有被清掉。
 * 因此刻意不 import h3 的类型：那会引入一个并非本项目直接依赖的包。
 */

/** 被测路由接收的事件（我们只构造路由真正会用到的那几个入口） */
export interface RouteEvent {
  __body: unknown
  __query: Record<string, unknown>
  __status?: number
  __sessionUser?: SessionUser | null
  node: { req: { socket: { remoteAddress: string } } }
}

export interface SessionUser {
  id?: number | string
  username?: string
}

export interface FakeEventInit {
  body?: unknown
  query?: Record<string, unknown>
  sessionUser?: SessionUser | null
  ip?: string
}

/** 会话被清了几次（注销流程要断言它） */
export const sessionTracker = { clears: 0 }

/** 造一个只含路由会用到的字段的事件对象 */
export function makeEvent(init: FakeEventInit = {}): RouteEvent {
  const ip = init.ip ?? '203.0.113.7'
  return {
    __body: init.body ?? null,
    __query: init.query ?? {},
    __status: undefined,
    __sessionUser: init.sessionUser === undefined ? null : init.sessionUser,
    node: { req: { socket: { remoteAddress: ip } } },
  }
}

/** 路由默认导出的形态是 Nitro 的 EventHandler，这里按我们注入的替身事件调用 */
export type RouteHandler = (event: RouteEvent) => Promise<unknown>

export function observe(event: RouteEvent) {
  return { status: event.__status, sessionUser: event.__sessionUser ?? null }
}

function install(): void {
  const g = globalThis as unknown as Record<string, unknown>

  g.defineEventHandler = (handler: RouteHandler) => handler
  g.readBody = async (event: RouteEvent) => event.__body
  g.getQuery = (event: RouteEvent) => event.__query
  // 限流器取真实 IP 时会用它；不开 trustProxy 时返回值不参与判定，但函数必须存在
  g.getRequestHeader = () => undefined
  g.setResponseStatus = (event: RouteEvent, code: number) => {
    event.__status = code
  }
  g.getUserSession = async (event: RouteEvent) => ({ user: event.__sessionUser ?? undefined })
  g.clearUserSession = async (event: RouteEvent) => {
    sessionTracker.clears += 1
    event.__sessionUser = null
  }
  g.useRuntimeConfig = () => ({ trustProxy: false })
}

install()

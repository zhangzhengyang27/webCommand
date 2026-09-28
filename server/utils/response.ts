import type { EventHandler, H3Event } from 'h3'

/**
 * 业务异常：携带业务码与 HTTP 状态码
 */
export class BizError extends Error {
  code: number
  statusCode: number
  constructor(code: number, message: string, statusCode = 200) {
    super(message)
    this.name = 'BizError'
    this.code = code
    this.statusCode = statusCode
  }
}

// 业务错误码：与 HTTP 状态码解耦
export const ERROR_CODE = {
  PARAMS: 40000,
  NO_AUTH: 40100,
  FORBIDDEN: 40300,
  NOT_FOUND: 40400,
  RATE_LIMIT: 42900,
  SYSTEM: 50000,
  THIRD_PART: 50010,
} as const

export function ok<T>(data: T) {
  return { code: 0, data }
}

export function fail(code: number, message: string, data: unknown = null) {
  return { code, message, data }
}

/**
 * 包装业务 handler，统一输出 { code, data, message }。
 * 业务错误仍以 HTTP 200 返回，错误码放在 body.code（前端按 code 分支处理）。
 */
export function bizHandler(fn: (event: H3Event) => unknown | Promise<unknown>): EventHandler {
  return defineEventHandler(async (event) => {
    try {
      const data = await fn(event)
      return ok(data === undefined ? true : data)
    } catch (e) {
      if (e instanceof BizError) {
        if (e.statusCode && e.statusCode !== 200) setResponseStatus(event, e.statusCode)
        return fail(e.code, e.message)
      }
      console.error('[api error]', event.path, e)
      return fail(ERROR_CODE.SYSTEM, 'server error')
    }
  })
}

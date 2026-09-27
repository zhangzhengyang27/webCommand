/**
 * 账号安全策略（纯函数，自包含：不 import 本目录其它模块，原生 ESM 才能直接跑单测）。
 *
 * 校验口令长度与注销条件。服务端与前端各有一份 MIN_PASSWORD_LENGTH，
 * 两处必须一致（有契约测试比对），否则前端提示"至少 8 位"而服务端按别的值拒绝。
 */

/** 新设口令的最小长度；已注册的短口令仍可登录 */
export const MIN_PASSWORD_LENGTH = 8

/** 合法返回 null，非法返回给用户看的提示 */
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return '密码不能为空'
  if (password.length < MIN_PASSWORD_LENGTH) return `密码至少 ${MIN_PASSWORD_LENGTH} 位`
  return null
}

/**
 * 邮箱格式校验。
 *
 * 本地部分允许 `.+_%-`（RFC 5322 常见子集）：此前只允许字母数字与中文，
 * 导致 first.last@gmail.com、tag+promo@gmail.com、my_name@corp.com 这类完全合法的地址被拒，
 * 对开放注册的服务是真实的注册漏斗漏洞。这里刻意不追求"完整 RFC 校验"
 * （那需要发验证邮件才算数），只保证不误杀合法写法。
 */
const EMAIL_RE = /^[A-Za-z0-9._%+\-\u4e00-\u9fa5]+@[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email)
}

export interface AccountUserRef {
  id?: number | string | null
  username?: string | null
}

/** 注销判定：通过时交回生效的 userId，路由层不必写非空断言 */
export type DeletionDecision =
  { ok: true; userId: number | string } | { ok: false; code: 'NO_AUTH' | 'PARAMS'; message: string }

/**
 * 账号注销属于不可逆操作，要求三件齐全：
 * 1. 已登录（会话里有 id 与 username）；
 * 2. 手动输入的确认串与用户名完全一致（防误触发，也让"删哪个账号"是明确表达）；
 * 3. 重新输入密码（会话被复用/借用时不足以凭会话删号；口令校验在 service 层做）。
 */
export function checkAccountDeletion(
  user: AccountUserRef | null | undefined,
  confirmName: unknown,
  password: unknown,
): DeletionDecision {
  if (!user?.id || !user.username) return { ok: false, code: 'NO_AUTH', message: '未登录' }
  if (typeof password !== 'string' || !password) {
    return { ok: false, code: 'PARAMS', message: '注销账号需要重新输入密码确认身份' }
  }
  if (typeof confirmName !== 'string' || confirmName !== user.username) {
    return {
      ok: false,
      code: 'PARAMS',
      message: `确认串必须与用户名完全一致，请执行 user delete --confirm ${user.username}`,
    }
  }
  return { ok: true, userId: user.id }
}

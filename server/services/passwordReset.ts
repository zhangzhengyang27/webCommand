import crypto from 'node:crypto'
import { BizError, ERROR_CODE } from '../utils/response'

/**
 * 找回密码验证码（内存存储，进程重启失效，单实例足够；多实例应改 Redis）。
 * 对齐原 service/passwordResetService.js。
 */
const CODE_TTL = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const RESEND_INTERVAL = 60 * 1000

interface CodeEntry {
  codeHash: string
  expiresAt: number
  attempts: number
  lastSentAt: number
}

const codeMap = new Map<string, CodeEntry>()

function hashCode(email: string, code: string) {
  return crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}:${code}`)
    .digest('hex')
}

function sweep() {
  const now = Date.now()
  for (const [key, entry] of codeMap) {
    if (entry.expiresAt < now) codeMap.delete(key)
  }
}

/** 签发 6 位数字验证码 */
export function issueCode(email: string): string {
  const key = email.toLowerCase()
  const entry = codeMap.get(key)
  const now = Date.now()
  if (entry && now - entry.lastSentAt < RESEND_INTERVAL) {
    const waitSec = Math.ceil(
      (RESEND_INTERVAL - (now - entry.lastSentAt)) / 1000,
    )
    throw new BizError(ERROR_CODE.PARAMS, `发送过于频繁，请 ${waitSec} 秒后再试`)
  }
  if (codeMap.size > 1000) sweep()
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  codeMap.set(key, {
    codeHash: hashCode(key, code),
    expiresAt: now + CODE_TTL,
    attempts: 0,
    lastSentAt: now,
  })
  return code
}

/** 校验验证码（成功后立即失效） */
export function verifyCode(email: string, code: string): boolean {
  const key = email.toLowerCase()
  const entry = codeMap.get(key)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    codeMap.delete(key)
    return false
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    codeMap.delete(key)
    return false
  }
  entry.attempts++
  const sent = hashCode(key, code) === entry.codeHash
  if (sent) codeMap.delete(key)
  return sent
}

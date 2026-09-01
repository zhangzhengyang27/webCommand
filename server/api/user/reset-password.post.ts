import { findActiveUserByEmail, resetUserPassword } from '../../services/userService'
import { verifyCode } from '../../services/passwordReset'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { authLimiter } from '../../utils/rateLimit'

export default bizHandler(async (event) => {
  if (authLimiter.hit(event)) throw new BizError(ERROR_CODE.PARAMS, '操作过于频繁，请稍后再试', 429)
  const { email, code, newPassword } = (await readBody(event)) || {}
  if (!email || !code || !newPassword) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  if (!verifyCode(email, code)) throw new BizError(ERROR_CODE.PARAMS, '验证码错误或已过期')
  const user = await findActiveUserByEmail(email)
  if (!user) throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在')
  return await resetUserPassword((user.toJSON() as any).id, newPassword)
})

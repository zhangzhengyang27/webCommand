import { findActiveUserByEmail } from '../../services/userService'
import { issueCode } from '../../services/passwordReset'
import { isMailConfigured, sendMail } from '../../thirdparty/mailer'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { authLimiter } from '../../utils/rateLimit'

export default bizHandler(async (event) => {
  if (authLimiter.hit(event)) throw new BizError(ERROR_CODE.PARAMS, '操作过于频繁，请稍后再试', 429)
  const { email } = (await readBody(event)) || {}
  if (!email) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  if (!isMailConfigured())
    throw new BizError(ERROR_CODE.THIRD_PART, '邮件服务未配置，请联系管理员设置 SMTP 环境变量')
  const user = await findActiveUserByEmail(email)
  if (!user) return true // 不泄露邮箱是否已注册
  const code = issueCode(email)
  try {
    await sendMail({
      to: email,
      subject: 'webCommand 找回密码验证码',
      text: `你的验证码是 ${code}，10 分钟内有效。若非本人操作请忽略本邮件。`,
    })
  } catch (e: unknown) {
    console.error('send reset code mail failed:', e instanceof Error ? e.message : e)
    throw new BizError(ERROR_CODE.THIRD_PART, '邮件发送失败，请稍后再试')
  }
  return true
})

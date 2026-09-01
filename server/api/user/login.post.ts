import { verifyCredentials } from '../../services/userService'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { authLimiter } from '../../utils/rateLimit'

const SESSION_30D = 60 * 60 * 24 * 30

export default bizHandler(async (event) => {
  if (authLimiter.hit(event)) throw new BizError(ERROR_CODE.PARAMS, '操作过于频繁，请稍后再试', 429)
  const { username, password, remember } = (await readBody(event)) || {}
  const safeUser = await verifyCredentials(username, password)
  // 自动登录（remember!==false）持久化 30 天；否则使用默认会话策略
  const rememberFlag = remember !== false
  await setUserSession(event, { user: safeUser }, rememberFlag ? { maxAge: SESSION_30D } : {})
  return safeUser
})

import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { authLimiter } from '../../utils/rateLimit'
import { checkAccountDeletion } from '../../utils/accountPolicy'
import { deleteAccount } from '../../services/userService'

// 注销账号：软删用户并删除其全部云端数据，随后清掉当前会话
export default bizHandler(async (event) => {
  if (authLimiter.hit(event)) throw new BizError(ERROR_CODE.PARAMS, '操作过于频繁，请稍后再试', 429)
  const { user } = await getUserSession(event)
  const { password, confirm } = (await readBody(event)) || {}
  const decision = checkAccountDeletion(user, confirm, password)
  if (!decision.ok) throw new BizError(ERROR_CODE[decision.code], decision.message)
  await deleteAccount(decision.userId, String(password))
  await clearUserSession(event)
  return true
})

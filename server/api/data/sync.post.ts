import { UserDataModel, type UserDataAttributes } from '../../models/UserData'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { dataLimiter } from '../../utils/rateLimit'
import { checkDataWrite } from '../../utils/dataAccess'

// 同步（upsert）用户云端数据
export default bizHandler(async (event) => {
  if (dataLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '同步过于频繁，请稍后再试', 429)
  const { user } = await getUserSession(event)
  const { type, content } = (await readBody(event)) || {}
  const decision = checkDataWrite(user, type, content)
  if (!decision.ok) throw new BizError(ERROR_CODE[decision.code], decision.message)
  await UserDataModel().upsert({
    userId: decision.userId,
    type: decision.type,
    content: decision.content,
  } as UserDataAttributes)
  return true
})

import { UserDataModel } from '../../models/UserData'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { dataLimiter } from '../../utils/rateLimit'
import { checkDataRead } from '../../utils/dataAccess'

// 加载用户云端数据（待办 / 空间等），对齐原 GET /api/data
export default bizHandler(async (event) => {
  if (dataLimiter.hit(event))
    throw new BizError(ERROR_CODE.RATE_LIMIT, '同步过于频繁，请稍后再试', 429)
  const { user } = await getUserSession(event)
  const decision = checkDataRead(user, getQuery(event).type)
  if (!decision.ok) throw new BizError(ERROR_CODE[decision.code], decision.message)
  const row = await UserDataModel().findOne({
    where: { userId: decision.userId, type: decision.type },
  })
  return row ? row.getDataValue('content') : null
})

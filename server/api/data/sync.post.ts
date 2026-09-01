import { UserDataModel } from '../../models/UserData'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'

// 同步（upsert）用户云端数据，对齐原 POST /api/data/sync
export default bizHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user
  if (!user?.id) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  const { type, content } = (await readBody(event)) || {}
  if (!type || typeof type !== 'string' || type.length > 32)
    throw new BizError(ERROR_CODE.PARAMS, 'type 不合法')
  if (typeof content !== 'string' || content.length > 1024 * 1024)
    throw new BizError(ERROR_CODE.PARAMS, 'content 不合法')
  await UserDataModel().upsert({ userId: user.id, type, content } as any)
  return true
})

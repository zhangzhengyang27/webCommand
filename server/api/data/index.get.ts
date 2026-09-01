import { UserDataModel } from '../../models/UserData'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'

// 加载用户云端数据（待办 / 空间等），对齐原 GET /api/data
export default bizHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user
  if (!user?.id) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  const type = getQuery(event).type as string | undefined
  if (!type) throw new BizError(ERROR_CODE.PARAMS, '缺少 type')
  const row = await UserDataModel().findOne({
    where: { userId: user.id, type },
  })
  return row ? (row.toJSON() as any).content : null
})

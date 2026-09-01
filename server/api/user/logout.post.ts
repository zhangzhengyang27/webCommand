import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'

export default bizHandler(async (event) => {
  const session = await getUserSession(event)
  if (!(session as any)?.user) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  await clearUserSession(event)
  return true
})

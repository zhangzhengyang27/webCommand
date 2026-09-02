import { getLoginUserById } from '../../services/userService'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'

export default bizHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session.user
  if (!user?.id) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  // 从数据库重新读取最新用户信息并脱敏
  return await getLoginUserById(user.id)
})

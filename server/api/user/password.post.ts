import { updateUserPassword } from '../../services/userService'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'

export default bizHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user
  if (!user?.id) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  const { oldPassword, newPassword } = (await readBody(event)) || {}
  return await updateUserPassword(user.id, oldPassword, newPassword)
})

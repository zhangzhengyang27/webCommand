import { userRegister } from '../../services/userService'
import { bizHandler, BizError, ERROR_CODE } from '../../utils/response'
import { authLimiter } from '../../utils/rateLimit'

export default bizHandler(async (event) => {
  if (authLimiter.hit(event))
    throw new BizError(ERROR_CODE.PARAMS, '操作过于频繁，请稍后再试', 429)
  const { username, password, email } = (await readBody(event)) || {}
  return await userRegister(username, password, email)
})

import myAxios, { type ApiResult } from '../../../utils/myAxios'
import UserType = User.UserType

/**
 * 用户登录
 * @param username
 * @param password
 */
export const userLogin = async (
  username: string,
  password: string,
  remember = true,
): Promise<ApiResult<UserType> | null> => {
  if (!username || !password) {
    return null
  }
  return await myAxios.post<UserType>('/user/login', { username, password, remember })
}

/**
 * 用户注销
 */
export const userLogout = async (): Promise<ApiResult<boolean>> => {
  return await myAxios.post<boolean>('/user/logout')
}

/**
 * 用户注册
 * @param username
 * @param password
 * @param email
 */
export const userRegister = async (
  username: string,
  password: string,
  email: string,
): Promise<ApiResult<number> | null> => {
  if (!username || !password || !email) {
    return null
  }
  return await myAxios.post<number>('/user/register', { username, password, email })
}

/**
 * 获取当前登录用户
 */
export const getLoginUser = async (): Promise<ApiResult<UserType>> => {
  return await myAxios.post<UserType>('/user/current')
}

/**
 * 修改密码（需登录）
 * @param oldPassword
 * @param newPassword
 */
export const updateUserPassword = async (
  oldPassword: string,
  newPassword: string,
): Promise<ApiResult<boolean>> => {
  return await myAxios.post<boolean>('/user/password', { oldPassword, newPassword })
}

/**
 * 发送找回密码验证码
 * @param email
 */
export const sendResetCode = async (email: string): Promise<ApiResult<boolean>> => {
  return await myAxios.post<boolean>('/user/reset-code', { email })
}

/**
 * 通过邮箱验证码重置密码
 * @param email
 * @param code
 * @param newPassword
 */
export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<ApiResult<boolean>> => {
  return await myAxios.post<boolean>('/user/reset-password', {
    email,
    code,
    newPassword,
  })
}

/**
 * 注销账号（删除云端数据，需重新输入密码并确认用户名）
 * @param password 当前密码
 * @param confirm 与用户名完全一致的确认串
 */
export const userDelete = async (
  password: string,
  confirm: string,
): Promise<ApiResult<boolean>> => {
  return await myAxios.post<boolean>('/user/delete', { password, confirm })
}

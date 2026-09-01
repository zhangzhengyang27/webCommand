import myAxios from "../../../utils/myAxios";

/**
 * 用户登录
 * @param username
 * @param password
 */
export const userLogin = async (
  username: string,
  password: string,
  remember = true,
) => {
  if (!username || !password) {
    return null;
  }
  return await myAxios.post("/user/login", { username, password, remember });
};

/**
 * 用户注销
 */
export const userLogout = async () => {
  return await myAxios.post("/user/logout");
};

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
) => {
  if (!username || !password || !email) {
    return null;
  }
  return await myAxios.post("/user/register", { username, password, email });
};

/**
 * 获取当前登录用户
 */
export const getLoginUser = async () => {
  return await myAxios.post("/user/current");
};

/**
 * 修改密码（需登录）
 * @param oldPassword
 * @param newPassword
 */
export const updateUserPassword = async (
  oldPassword: string,
  newPassword: string,
) => {
  return await myAxios.post("/user/password", { oldPassword, newPassword });
};

/**
 * 发送找回密码验证码
 * @param email
 */
export const sendResetCode = async (email: string) => {
  return await myAxios.post("/user/reset-code", { email });
};

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
) => {
  return await myAxios.post("/user/reset-password", {
    email,
    code,
    newPassword,
  });
};

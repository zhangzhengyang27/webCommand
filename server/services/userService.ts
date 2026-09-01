import { Op, UniqueConstraintError } from 'sequelize'
import bcrypt from 'bcryptjs'
import md5 from 'md5'
import { UserModel, toSafeUser, type SafeUser } from '../models/User'
import { BizError, ERROR_CODE } from '../utils/response'

// 历史密码加盐（仅兼容旧用户）
const SALT = 'coder_yupi'
const BCRYPT_ROUNDS = 10

function isBcrypt(hash?: string) {
  return !!hash && hash.startsWith('$2')
}

/** 校验密码：优先 bcrypt，兼容历史 MD5 */
async function verifyPassword(raw: string, hashed: string): Promise<boolean> {
  if (isBcrypt(hashed)) return bcrypt.compare(raw, hashed)
  return hashed === md5(raw + SALT)
}

/** 注册，返回新用户 id */
export async function userRegister(
  username: string,
  password: string,
  email: string,
): Promise<number> {
  if (!username || !password || !email)
    throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  if (username.length > 32)
    throw new BizError(ERROR_CODE.PARAMS, '用户名过长')
  if (password.length < 6)
    throw new BizError(ERROR_CODE.PARAMS, '密码至少 6 位')
  const regEmail = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/
  if (!regEmail.test(email))
    throw new BizError(ERROR_CODE.PARAMS, '邮箱非法')

  const existed = await UserModel().findOne({
    where: { [Op.or]: [{ username }, { email }] },
  })
  if (existed)
    throw new BizError(ERROR_CODE.PARAMS, '该用户名或邮箱已被注册')

  try {
    const user = await UserModel().create({
      username,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      email,
      status: 0,
      isDelete: 0,
    } as any)
    return (user as any).id
  } catch (e) {
    if (e instanceof UniqueConstraintError)
      throw new BizError(ERROR_CODE.PARAMS, '该用户名或邮箱已被注册')
    throw e
  }
}

/**
 * 校验账号密码并返回脱敏用户（登录核心逻辑，session 写入交由路由层）。
 * 历史 MD5 密码校验通过后自动升级为 bcrypt。
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<SafeUser> {
  if (!username || !password)
    throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  const user = await UserModel().findOne({ where: { username } })
  if (!user)
    throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在或密码错误')
  const attrs = user.toJSON() as any
  if (attrs.isDelete)
    throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在或密码错误')
  if (attrs.status !== 0)
    throw new BizError(ERROR_CODE.NO_AUTH, '账号已被封禁')

  const valid = await verifyPassword(password, attrs.password)
  if (!valid)
    throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在或密码错误')

  if (!isBcrypt(attrs.password)) {
    await UserModel().update(
      { password: await bcrypt.hash(password, BCRYPT_ROUNDS) },
      { where: { id: attrs.id } },
    )
  }
  return toSafeUser(user)
}

/** 按 id 获取当前登录用户（脱敏），无效则抛错 */
export async function getLoginUserById(id: number | string): Promise<SafeUser> {
  if (!id) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  const user = await UserModel().findByPk(id)
  if (!user || (user.toJSON() as any).isDelete)
    throw new BizError(ERROR_CODE.NOT_FOUND, '找不到该用户')
  return toSafeUser(user)
}

/** 修改密码（校验旧密码） */
export async function updateUserPassword(
  userId: number | string,
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  if (!oldPassword || !newPassword)
    throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  if (newPassword.length < 6)
    throw new BizError(ERROR_CODE.PARAMS, '密码至少 6 位')
  const user = await UserModel().findByPk(userId)
  if (!user || (user.toJSON() as any).isDelete)
    throw new BizError(ERROR_CODE.NOT_FOUND, '找不到该用户')
  const attrs = user.toJSON() as any
  if (!(await verifyPassword(oldPassword, attrs.password)))
    throw new BizError(ERROR_CODE.PARAMS, '旧密码错误')
  if (await verifyPassword(newPassword, attrs.password))
    throw new BizError(ERROR_CODE.PARAMS, '新密码不能与旧密码相同')
  await UserModel().update(
    { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    { where: { id: userId } },
  )
  return true
}

/** 通过邮箱查找有效用户（找回密码） */
export async function findActiveUserByEmail(email: string) {
  if (!email) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  return UserModel().findOne({ where: { email, isDelete: 0 } })
}

/** 重置密码（邮箱验证码流程，不校验旧密码） */
export async function resetUserPassword(
  userId: number | string,
  newPassword: string,
): Promise<boolean> {
  if (!newPassword || newPassword.length < 6)
    throw new BizError(ERROR_CODE.PARAMS, '密码至少 6 位')
  await UserModel().update(
    { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    { where: { id: userId } },
  )
  return true
}

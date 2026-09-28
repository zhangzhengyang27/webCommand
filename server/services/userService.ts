import { Op, UniqueConstraintError } from 'sequelize'
import bcrypt from 'bcryptjs'
import { UserModel, toSafeUser, type SafeUser, type UserAttributes } from '../models/User'
import { UserDataModel } from '../models/UserData'
import { useDb } from '../utils/db'
import { BizError, ERROR_CODE } from '../utils/response'
import { isValidEmail, validateNewPassword } from '../utils/accountPolicy'

/** 口令长度等基础校验，不合法时直接抛出面向用户的提示 */
function assertNewPassword(password: unknown): asserts password is string {
  const message = validateNewPassword(password)
  if (message) throw new BizError(ERROR_CODE.PARAMS, message)
}

const BCRYPT_ROUNDS = 10

/** 校验密码：口令一律为 bcrypt 哈希 */
async function verifyPassword(raw: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(raw, hashed)
}

/** 注册，返回新用户 id */
export async function userRegister(
  username: string,
  password: string,
  email: string,
): Promise<number> {
  if (!username || !password || !email) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  if (username.length > 32) throw new BizError(ERROR_CODE.PARAMS, '用户名过长')
  assertNewPassword(password)
  if (!isValidEmail(email)) throw new BizError(ERROR_CODE.PARAMS, '邮箱非法')

  const existed = await UserModel().findOne({
    where: { [Op.or]: [{ username }, { email }] },
  })
  if (existed) throw new BizError(ERROR_CODE.PARAMS, '该用户名或邮箱已被注册')

  try {
    const user = await UserModel().create({
      username,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      email,
      status: 0,
      isDelete: 0,
    } as UserAttributes)
    return user.getDataValue('id')
  } catch (e) {
    if (e instanceof UniqueConstraintError)
      throw new BizError(ERROR_CODE.PARAMS, '该用户名或邮箱已被注册')
    throw e
  }
}

/** 校验账号密码并返回脱敏用户（登录核心逻辑，session 写入交由路由层） */
export async function verifyCredentials(username: string, password: string): Promise<SafeUser> {
  if (!username || !password) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  const user = await UserModel().findOne({ where: { username } })
  if (!user) throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在或密码错误')
  const attrs = user.toJSON() as UserAttributes
  if (attrs.isDelete) throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在或密码错误')
  if (attrs.status !== 0) throw new BizError(ERROR_CODE.NO_AUTH, '账号已被封禁')

  const valid = await verifyPassword(password, attrs.password)
  if (!valid) throw new BizError(ERROR_CODE.NOT_FOUND, '用户不存在或密码错误')

  return toSafeUser(user)
}

/** 按 id 获取当前登录用户（脱敏），无效则抛错 */
export async function getLoginUserById(id: number | string): Promise<SafeUser> {
  if (!id) throw new BizError(ERROR_CODE.NO_AUTH, '未登录')
  const user = await UserModel().findByPk(id)
  if (!user || (user.toJSON() as UserAttributes).isDelete)
    throw new BizError(ERROR_CODE.NOT_FOUND, '找不到该用户')
  return toSafeUser(user)
}

/** 修改密码（校验旧密码） */
export async function updateUserPassword(
  userId: number | string,
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  if (!oldPassword || !newPassword) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  assertNewPassword(newPassword)
  const user = await UserModel().findByPk(userId)
  if (!user || (user.toJSON() as UserAttributes).isDelete)
    throw new BizError(ERROR_CODE.NOT_FOUND, '找不到该用户')
  const attrs = user.toJSON() as UserAttributes
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

/**
 * 注销账号：校验当前口令后软删用户，并删除其全部云端数据。
 *
 * user 保留一行（isDelete=1）便于事后核对；user_data 直接物理删除——
 * "删除我的数据"这条承诺不能靠后续清理来兑现。两步放在同一事务里，
 * 避免出现"数据没了但账号还能登录"的半删状态。
 */
export async function deleteAccount(userId: number | string, password: string): Promise<boolean> {
  if (!userId || !password) throw new BizError(ERROR_CODE.PARAMS, '参数错误')
  const user = await UserModel().findByPk(userId)
  if (!user || (user.toJSON() as UserAttributes).isDelete)
    throw new BizError(ERROR_CODE.NOT_FOUND, '找不到该用户')
  const attrs = user.toJSON() as UserAttributes
  if (!(await verifyPassword(password, attrs.password)))
    throw new BizError(ERROR_CODE.PARAMS, '密码错误')
  const transaction = await useDb().transaction()
  try {
    await UserDataModel().destroy({ where: { userId: attrs.id }, transaction })
    await UserModel().update({ isDelete: 1 }, { where: { id: attrs.id }, transaction })
    await transaction.commit()
  } catch (e) {
    await transaction.rollback()
    throw e
  }
  return true
}

/** 重置密码（邮箱验证码流程，不校验旧密码） */
export async function resetUserPassword(
  userId: number | string,
  newPassword: string,
): Promise<boolean> {
  assertNewPassword(newPassword)
  await UserModel().update(
    { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    { where: { id: userId } },
  )
  return true
}

import { DataTypes } from 'sequelize'
import type { Model, ModelStatic } from 'sequelize'
import { useDb } from '../utils/db'

export interface UserAttributes {
  id: number
  username: string
  password: string
  email?: string
  status: number
  createTime?: Date
  updateTime?: Date
  isDelete: number
}

export type SafeUser = Omit<UserAttributes, 'password'>

let model: ModelStatic<Model<UserAttributes>> | null = null

/** 用户表模型（懒加载单例） */
export function UserModel(): ModelStatic<Model<UserAttributes>> {
  if (model) return model
  model = useDb().define(
    'User',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      password: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, unique: true },
      status: { type: DataTypes.INTEGER, defaultValue: 0 },
      createTime: { type: DataTypes.DATE },
      updateTime: { type: DataTypes.DATE },
      isDelete: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    { tableName: 'user', timestamps: false },
  )
  return model
}

/** 去除密码字段 */
export function toSafeUser(user: Model<UserAttributes>): SafeUser {
  const { password: _pw, ...safe } = user.toJSON() as UserAttributes
  return safe
}

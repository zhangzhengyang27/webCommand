import { DataTypes } from 'sequelize'
import type { Model, ModelStatic } from 'sequelize'
import { useDb } from '../utils/db'

export interface UserDataAttributes {
  id: number
  userId: number
  type: string
  content?: string
}

let model: ModelStatic<Model<UserDataAttributes>> | null = null

/**
 * 用户数据云端同步表（待办 / 空间等），以 (userId,type) 为唯一键。
 */
export function UserDataModel(): ModelStatic<Model<UserDataAttributes>> {
  if (model) return model
  model = useDb().define(
    'UserData',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      type: { type: DataTypes.STRING(32), allowNull: false },
      content: { type: DataTypes.TEXT('medium') },
    },
    {
      tableName: 'user_data',
      timestamps: false,
      indexes: [{ unique: true, fields: ['userId', 'type'] }],
    },
  )
  return model
}

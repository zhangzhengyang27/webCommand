import { UserDataModel } from '../models/UserData'

// 启动时同步 user_data 表（对齐原 index.js 中的 UserDataModel.sync()）
export default defineNitroPlugin(() => {
  UserDataModel()
    .sync()
    .catch((e: unknown) =>
      console.error('user_data 表同步失败', e instanceof Error ? e.message : e),
    )
})

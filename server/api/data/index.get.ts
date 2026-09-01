import { UserDataModel } from '../../models/UserData'

// 加载用户云端数据（待办 / 空间等），对齐原 GET /api/data
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user
  if (!user?.id) {
    setResponseStatus(event, 401)
    return { code: 401, message: '未登录', data: null }
  }
  const type = getQuery(event).type as string | undefined
  if (!type) {
    setResponseStatus(event, 400)
    return { code: 400, message: '缺少 type', data: null }
  }
  try {
    const row = await UserDataModel().findOne({
      where: { userId: user.id, type },
    })
    return { code: 0, data: row ? (row.toJSON() as any).content : null }
  } catch (e: any) {
    console.error('load data error:', e?.message || e)
    setResponseStatus(event, 502)
    return { code: 502, message: '加载失败', data: null }
  }
})

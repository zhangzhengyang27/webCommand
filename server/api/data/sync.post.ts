import { UserDataModel } from '../../models/UserData'

// 同步（upsert）用户云端数据，对齐原 POST /api/data/sync
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user
  if (!user?.id) {
    setResponseStatus(event, 401)
    return { code: 401, message: '未登录', data: null }
  }
  const { type, content } = (await readBody(event)) || {}
  if (!type || typeof type !== 'string' || type.length > 32) {
    setResponseStatus(event, 400)
    return { code: 400, message: 'type 不合法', data: null }
  }
  if (typeof content !== 'string' || content.length > 1024 * 1024) {
    setResponseStatus(event, 400)
    return { code: 400, message: 'content 不合法', data: null }
  }
  try {
    await UserDataModel().upsert({ userId: user.id, type, content } as any)
    return { code: 0, data: true }
  } catch (e: any) {
    console.error('sync data error:', e?.message || e)
    setResponseStatus(event, 502)
    return { code: 502, message: '同步失败', data: null }
  }
})

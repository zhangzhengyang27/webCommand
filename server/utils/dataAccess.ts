/**
 * 云端数据接口的准入判定（纯函数，不连数据库就能测到安全边界）。
 *
 * 管三件事，都是路由层最容易被改错的地方：
 * 1. 必须登录——数据按 userId 分片，匿名读写等于跨用户串数据；
 * 2. type 必须在白名单内——否则任意登录用户能用自造 type 反复写大 blob；
 * 3. 单条 blob 按类型分级限额——数据类（待办/空间/笔记）1MB，配置类（自定义命令/
 *    终端配置/主题）64KB。user_data.content 列是 MEDIUMTEXT（约 16MB），
 *    数据库本身拦不住越界写入，应用层这道检查就是唯一闸门。
 *
 * 放行时把生效的 userId / type 一起返回：路由层因此不需要 `user!`，
 * 也不可能把 undefined 当查询条件传进 where（那会变成无过滤的全表条件）。
 *
 * 按用户的总容量配额仍未实现（当前是每个类型各限一次，一个人最多约 3.2MB）。
 */

/** 允许云端存储的数据类型；必须与 app/composables/cloudSyncRegistry.ts 的清单一致 */
export const CLOUD_DATA_TYPES = [
  'todo',
  'space',
  'note',
  'custom',
  'terminalConfig',
  'theme',
] as const

export type CloudDataType = (typeof CLOUD_DATA_TYPES)[number]

/** 数据类单条上限（字节）：待办 / 空间 / 笔记可能真的很大 */
export const MAX_DATA_CONTENT_BYTES = 1024 * 1024

/** 配置类单条上限（字节）：主题名、自定义命令表、终端配置正常只有几 KB */
export const MAX_CONFIG_CONTENT_BYTES = 64 * 1024

/** 按类型分级限额，防止有人把配置类型当成大对象存储灌 */
export function contentLimitFor(type: CloudDataType): number {
  return type === 'todo' || type === 'space' || type === 'note'
    ? MAX_DATA_CONTENT_BYTES
    : MAX_CONFIG_CONTENT_BYTES
}

/** 会话里的用户，只依赖 id 字段 */
export interface SessionUserRef {
  id?: number | string | null
}

/** 判定结果：可判别联合，路由层靠 ok 收窄，不需要任何非空断言 */
export type DataDecision =
  | { ok: true; userId: number | string; type: CloudDataType; content?: string }
  | { ok: false; code: 'NO_AUTH' | 'PARAMS'; message: string }

export function isAllowedDataType(type: unknown): type is CloudDataType {
  return typeof type === 'string' && (CLOUD_DATA_TYPES as readonly string[]).includes(type)
}

function deny(code: 'NO_AUTH' | 'PARAMS', message: string): DataDecision {
  return { ok: false, code, message }
}

/** 读取准入：校验登录态与 type 白名单 */
export function checkDataRead(
  user: SessionUserRef | null | undefined,
  type: unknown,
): DataDecision {
  if (!user?.id) return deny('NO_AUTH', '未登录')
  if (!isAllowedDataType(type)) return deny('PARAMS', 'type 不合法')
  return { ok: true, userId: user.id, type }
}

/** 写入准入：读取的全部条件 + content 类型与该类型的尺寸上限 */
export function checkDataWrite(
  user: SessionUserRef | null | undefined,
  type: unknown,
  content: unknown,
): DataDecision {
  const read = checkDataRead(user, type)
  if (!read.ok) return read
  if (typeof content !== 'string') return deny('PARAMS', 'content 不合法')
  const limit = contentLimitFor(read.type)
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > limit) {
    return deny('PARAMS', `content 超过 ${limit} 字节上限（本次 ${bytes} 字节）`)
  }
  return { ...read, content }
}

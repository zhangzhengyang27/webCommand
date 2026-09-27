/**
 * 云同步合并原语
 *
 * 云端每一类数据（type）存的是「整包 blob」，因此冲突必须在客户端解决：
 * 不做逐条比较时，后上传的那一端会把另一端的新增条目和已删除条目的墓碑一起冲掉。
 */

/** 墓碑保留时长：超过该窗口的删除记录会被清理（之后同名条目可被另一端重新合并回来） */
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * 撤销删除记录：条目被重新创建或从备份恢复时调用，
 * 否则历史墓碑会在合并时把它再次消掉。
 */
export function clearDeleted(deleted: Record<string, number>, key: string): void {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- 墓碑表的 key 本就是动态条目 id
  delete deleted[key]
}

/** 参与逐条合并的条目：updateTime 为最后修改时刻（毫秒），历史数据可能没有 */
export interface Revivable {
  updateTime?: number
}

export interface MergeResult<T> {
  items: T[]
  deleted: Record<string, number>
}

/** 合并双方墓碑，同一 key 取更晚的删除时间 */
export function mergeTombstones(
  a: Record<string, number> = {},
  b: Record<string, number> = {},
): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const [key, time] of Object.entries(b)) {
    if (typeof time !== 'number') continue
    const prev = out[key]
    if (prev === undefined || time > prev) out[key] = time
  }
  return out
}

/** 丢弃超出保留窗口的墓碑，避免删除记录无限增长 */
export function pruneTombstones(
  deleted: Record<string, number> = {},
  now = Date.now(),
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, time] of Object.entries(deleted)) {
    if (now - time < TOMBSTONE_RETENTION_MS) out[key] = time
  }
  return out
}

/**
 * 按 key 做 last-write-wins 合并，并用墓碑消除已删除条目。
 *
 * 同一 key 双方都有时，updateTime 更晚的一方胜出（历史数据无 updateTime 视为 0，
 * 即本地新改动优先于旧云端数据）；被删除且条目修改时间不晚于删除时间的 key 不进入结果。
 *
 * @param cloudItems 云端条目
 * @param localItems 本地条目
 * @param keyOf 取条目唯一键（todo/note 用 id，space 用路径，custom 用命令名）
 * @param cloudDeleted 云端墓碑
 * @param localDeleted 本地墓碑
 */
export function mergeKeyed<T extends Revivable>(
  cloudItems: T[],
  localItems: T[],
  keyOf: (item: T) => string,
  cloudDeleted: Record<string, number> = {},
  localDeleted: Record<string, number> = {},
  now = Date.now(),
): MergeResult<T> {
  const deleted = pruneTombstones(mergeTombstones(cloudDeleted, localDeleted), now)
  const byKey = new Map<string, T>()
  for (const item of [...cloudItems, ...localItems]) {
    const key = keyOf(item)
    const exists = byKey.get(key)
    if (!exists || (item.updateTime ?? 0) >= (exists.updateTime ?? 0)) byKey.set(key, item)
  }
  const items: T[] = []
  for (const [key, item] of byKey) {
    const deletedAt = deleted[key]
    // 删除时间不早于条目修改时间 -> 视为已删除；条目改得更晚则视为「删掉后又重建」
    if (deletedAt !== undefined && (item.updateTime ?? 0) <= deletedAt) continue
    items.push(item)
  }
  return { items, deleted }
}

/** 带时间戳的 blob（配置类数据：整体取较新一方，不做字段级拆分） */
export interface Stamped {
  updatedAt?: number
}

/** 比较双方 blob 的新鲜程度：本地改动时间不早于云端时以本地为基准 */
export function localIsFresher(cloud: Stamped | null | undefined, localUpdatedAt: number): boolean {
  return localUpdatedAt >= (cloud?.updatedAt ?? 0)
}

/** 为一次本地改动打上修改时刻（毫秒） */
export function stampNow(): number {
  return Date.now()
}

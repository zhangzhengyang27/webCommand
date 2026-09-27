import myAxios from '../utils/myAxios'
import { useUserStore } from '../core/commands/user/userStore'
import { errMsg } from '../utils/error'

export interface CloudSyncOptions {
  /** 序列化当前数据为云端内容 */
  serialize: () => unknown
  /** 合并云端数据到本地（入参已 JSON.parse） */
  merge: (cloudData: unknown) => void
  /** 同步防抖延迟（毫秒），默认 800 */
  debounce?: number
}

export interface CloudSync {
  syncToCloud: () => void
  loadFromCloud: () => Promise<void>
  initCloudSync: (subscribe: () => () => void) => void
  resetCloudSync: () => void
}

/**
 * 云端数据同步工厂（登录后生效）。
 *
 * 上传前先拉取云端并合并（写前合并）：整包 blob 直接覆盖会把另一端新增的条目、
 * 或本端已删除条目的墓碑冲掉，因此每次 push 都以「云端 ∪ 本地」的合并结果为准。
 *
 * @param type 数据类型标识，与 /api/data 的 type 参数一致（需在服务端白名单内）
 * @param options 序列化与合并回调（合并逻辑由各数据结构的差异决定，保留在调用方）
 */
export function useCloudSync(type: string, options: CloudSyncOptions): CloudSync {
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let syncUserId: string | number | null = null
  let unsubscribe: (() => void) | null = null
  // 正在写入远端数据：此期间 store 变更不再触发上传，避免合并引发回环
  let applyingRemote = false

  const getUserId = (): string | number | null => useUserStore().loginUser?.id ?? null

  /** 拉取云端原始内容（未同步过时为 null） */
  async function fetchCloudRaw(): Promise<string | null> {
    const res = await myAxios.get<string>(`/data?type=${type}`)
    return res?.code === 0 && typeof res.data === 'string' && res.data ? res.data : null
  }

  /** 把云端内容应用到本地 */
  function applyCloud(raw: string) {
    applyingRemote = true
    try {
      options.merge(JSON.parse(raw))
    } finally {
      applyingRemote = false
    }
  }

  /** 防抖到点后执行：先合并云端，再上传合并结果 */
  async function flush() {
    let cloudRaw: string | null = null
    try {
      cloudRaw = await fetchCloudRaw()
      if (cloudRaw) applyCloud(cloudRaw)
    } catch (e) {
      // 拉取失败时仍上传本地数据，不因网络抖动丢掉本次变更
      console.error(`${type} 同步前拉取失败`, errMsg(e))
    }
    const content = JSON.stringify(options.serialize())
    // 云端已是最新：跳过上传，同时切断「合并 -> 订阅 -> 再同步」的回环
    if (content === cloudRaw) return
    try {
      await myAxios.post('/data/sync', { type, content })
    } catch (e) {
      console.error(`${type} 同步失败`, e)
    }
  }

  /** 同步到云端（防抖，未登录时跳过） */
  function syncToCloud() {
    if (!getUserId() || applyingRemote) return
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => void flush(), options.debounce ?? 800)
  }

  /** 从云端加载（合并逻辑由 options.merge 决定） */
  async function loadFromCloud() {
    if (!getUserId()) return
    try {
      const raw = await fetchCloudRaw()
      if (raw) applyCloud(raw)
    } catch (e) {
      console.error(`${type} 云端加载失败`, errMsg(e))
    }
  }

  /**
   * 初始化云同步：先拉取，再订阅后续变更（按用户幂等）。
   * @param subscribe 返回取消订阅函数的回调（如 () => store.$subscribe(...)）
   */
  function initCloudSync(subscribe: () => () => void) {
    const userId = getUserId()
    if (!userId) return
    if (syncUserId === userId) return
    resetCloudSync()
    syncUserId = userId
    loadFromCloud().finally(() => {
      unsubscribe = subscribe()
    })
  }

  /** 重置云同步：解除订阅并清除初始化标记（注销时调用） */
  function resetCloudSync() {
    if (syncTimer) {
      clearTimeout(syncTimer)
      syncTimer = undefined
    }
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    syncUserId = null
  }

  return { syncToCloud, loadFromCloud, initCloudSync, resetCloudSync }
}

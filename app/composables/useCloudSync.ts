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
 * 抽取自 space / todo / note 三个 store 中重复的云同步逻辑：
 * 防抖定时上传、按用户幂等初始化、换账号时解除旧订阅并重新拉取。
 *
 * @param type 数据类型标识，与 /api/data 的 type 参数一致（如 'space' | 'todo' | 'note'）
 * @param options 序列化与合并回调（合并逻辑由各数据结构的差异决定，保留在调用方）
 */
export function useCloudSync(type: string, options: CloudSyncOptions): CloudSync {
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let syncUserId: string | number | null = null
  let unsubscribe: (() => void) | null = null

  const getUserId = (): string | number | null => useUserStore().loginUser?.id ?? null

  /** 同步到云端（防抖 800ms，未登录时跳过） */
  function syncToCloud() {
    if (!getUserId()) return
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      myAxios
        .post('/data/sync', {
          type,
          content: JSON.stringify(options.serialize()),
        })
        .catch((e) => console.error(`${type} 同步失败`, e))
    }, options.debounce ?? 800)
  }

  /** 从云端加载（合并逻辑由 options.merge 决定） */
  async function loadFromCloud() {
    if (!getUserId()) return
    try {
      const res = await myAxios.get<string>(`/data?type=${type}`)
      if (res?.code === 0 && res.data) {
        options.merge(JSON.parse(res.data))
      }
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
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    syncUserId = null
  }

  return { syncToCloud, loadFromCloud, initCloudSync, resetCloudSync }
}

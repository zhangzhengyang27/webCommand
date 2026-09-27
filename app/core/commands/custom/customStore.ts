import { defineStore } from 'pinia'
import { useCloudSync } from '../../../composables/useCloudSync'
import { clearDeleted, mergeKeyed, pruneTombstones } from '../../../composables/cloudMerge'

/** 参与合并的自定义命令条目（touched 提供逐条修改时刻） */
interface CustomEntry {
  name: string
  text: string
  updateTime?: number
}

/**
 * 用户自定义命令（快捷方式）(#73)
 * 存储 name -> 要执行的命令文本，持久化到 localStorage，登录后可云端同步
 */
export const useCustomCommandStore = defineStore('customCommand', {
  state: () => ({
    customMap: {} as Record<string, string>,
    /** 各命令的本地修改时刻（name -> 毫秒），用于跨设备逐条比较谁更新 */
    touched: {} as Record<string, number>,
    /** 已删除命令墓碑（name -> 删除时刻），阻止其它设备把它重新合并回来 */
    deleted: {} as Record<string, number>,
  }),
  getters: {
    getCustom: (state) => (name: string) => state.customMap[name.toLowerCase()],
  },
  actions: {
    listCustom(): [string, string][] {
      return Object.entries(this.customMap)
    },
    addCustom(name: string, text: string) {
      const key = name.toLowerCase()
      this.customMap[key] = text
      this.touched[key] = Date.now()
      // 重新定义即撤销删除记录
      clearDeleted(this.deleted, key)
    },
    removeCustom(name: string) {
      const key = name.toLowerCase()
      if (!(key in this.customMap)) return
      const { [key]: _removed, ...rest } = this.customMap
      this.customMap = rest
      const { [key]: _touched, ...restTouched } = this.touched
      this.touched = restTouched
      this.deleted[key] = Date.now()
    },
    /**
     * 同步到云端（登录后）
     */
    syncToCloud() {
      cloudSync.syncToCloud()
    },
    /**
     * 初始化云端同步：先拉取，再订阅后续变更（按用户幂等）
     */
    initCloudSync() {
      cloudSync.initCloudSync(() => this.$subscribe(() => this.syncToCloud()))
    },
    /**
     * 重置云同步：解除订阅并清除初始化标记（注销时调用）
     */
    resetCloudSync() {
      cloudSync.resetCloudSync()
    },
    /**
     * 从备份导入（覆盖当前数据）
     */
    importBackup(map: Record<string, string>) {
      if (map && typeof map === 'object') {
        const now = Date.now()
        this.customMap = { ...map }
        this.touched = {}
        for (const name of Object.keys(map)) {
          const key = name.toLowerCase()
          this.touched[key] = now
          clearDeleted(this.deleted, key)
        }
      }
    },
  },
  persist: {
    key: 'custom-command-store',
    storage: window.localStorage,
  },
})

// 云同步实例（模块级单例；store 实例通过惰性调用获取，避免循环依赖）
const getStore = () => useCustomCommandStore()

function toEntries(map: Record<string, string>, touched: Record<string, number>): CustomEntry[] {
  return Object.entries(map).map(([name, text]) => ({
    name,
    text,
    updateTime: touched[name],
  }))
}

const cloudSync = useCloudSync('custom', {
  serialize: () => {
    const store = getStore()
    return {
      map: store.customMap,
      touched: store.touched,
      deleted: pruneTombstones(store.deleted),
    }
  },
  merge: (data) => {
    if (!data || typeof data !== 'object') return
    const cloud = data as {
      map?: Record<string, string>
      touched?: Record<string, number>
      deleted?: Record<string, number>
    }
    if (!cloud.map) return
    const store = getStore()
    const { items, deleted } = mergeKeyed<CustomEntry>(
      toEntries(cloud.map, cloud.touched ?? {}),
      toEntries(store.customMap, store.touched),
      (entry) => entry.name,
      cloud.deleted,
      store.deleted,
    )
    const map: Record<string, string> = {}
    const touched: Record<string, number> = {}
    for (const entry of items) {
      map[entry.name] = entry.text
      if (entry.updateTime) touched[entry.name] = entry.updateTime
    }
    store.customMap = map
    store.touched = touched
    store.deleted = deleted
  },
})

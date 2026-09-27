import { defineStore } from 'pinia'
import { useCloudSync } from '../../../composables/useCloudSync'
import { clearDeleted, mergeKeyed, pruneTombstones } from '../../../composables/cloudMerge'

/**
 * 速记条目
 */
export interface NoteType {
  id: string
  text: string
  createTime: string | Date
  /**
   * 最后修改时刻（毫秒），跨设备合并时同 id 冲突以此判定谁胜出；
   * 历史数据无该字段，按 0 处理
   */
  updateTime?: number
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8)

// 将云端返回的字符串日期还原为 Date 对象
function reviveNote(n: Record<string, unknown>): NoteType {
  return {
    id: String(n.id ?? ''),
    text: String(n.text ?? ''),
    createTime: n.createTime ? new Date(String(n.createTime)) : new Date(),
    updateTime: typeof n.updateTime === 'number' ? n.updateTime : undefined,
  }
}

/** 云端 note 的数据结构；历史数据为裸数组，合并时按旧结构兜底 */
interface NoteCloudShape {
  items: NoteType[]
  deleted: Record<string, number>
}

function parseCloud(data: unknown): NoteCloudShape {
  if (Array.isArray(data)) return { items: data as NoteType[], deleted: {} }
  if (data && typeof data === 'object') {
    const obj = data as { items?: unknown; deleted?: unknown }
    return {
      items: Array.isArray(obj.items) ? (obj.items as NoteType[]) : [],
      deleted:
        obj.deleted && typeof obj.deleted === 'object'
          ? (obj.deleted as Record<string, number>)
          : {},
    }
  }
  return { items: [], deleted: {} }
}

/**
 * 速记状态（随手记一句话，登录后云同步）
 */
export const useNoteStore = defineStore('note', {
  state: () => ({
    // 已删除条目墓碑（id -> 删除时刻），阻止其它设备把条目重新合并回来
    deleted: {} as Record<string, number>,
    noteList: [] as NoteType[],
  }),
  getters: {
    noteCount: (state) => state.noteList.length,
  },
  persist: {
    key: 'note-store',
    storage: window.localStorage,
  },
  actions: {
    addNote(text: string): boolean {
      if (!text?.trim()) {
        return false
      }
      this.noteList.unshift({
        id: generateId(),
        text: text.trim(),
        createTime: new Date(),
        updateTime: Date.now(),
      })
      this.syncToCloud()
      return true
    },
    removeNote(id: string): boolean {
      const index = this.noteList.findIndex((n) => n.id === id)
      if (index === -1) {
        return false
      }
      this.noteList.splice(index, 1)
      this.deleted[id] = Date.now()
      this.syncToCloud()
      return true
    },
    clearNotes(): number {
      const count = this.noteList.length
      const now = Date.now()
      for (const note of this.noteList) this.deleted[note.id] = now
      this.noteList = []
      this.syncToCloud()
      return count
    },
    /**
     * 同步到云端（登录后）
     */
    syncToCloud() {
      cloudSync.syncToCloud()
    },
    /**
     * 从云端加载（合并逻辑见 cloudSync 的 merge）
     */
    async loadFromCloud() {
      await cloudSync.loadFromCloud()
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
    importBackup(list: unknown) {
      const items = (Array.isArray(list) ? list : []).filter(
        (n): n is Record<string, unknown> => typeof n === 'object' && n !== null && 'text' in n,
      )
      const now = Date.now()
      this.noteList = items.map((n) => {
        const note = reviveNote(n)
        // 导入即恢复：改到最新时间并清掉墓碑，避免被历史删除记录再次消掉
        note.updateTime = now
        clearDeleted(this.deleted, note.id)
        return note
      })
      this.syncToCloud()
    },
  },
})

// 云同步实例（模块级单例；store 实例通过惰性调用获取，避免循环依赖）
const getStore = () => useNoteStore()

const cloudSync = useCloudSync('note', {
  serialize: () => ({
    items: getStore().noteList,
    deleted: pruneTombstones(getStore().deleted),
  }),
  merge: (data) => {
    const store = getStore()
    const cloud = parseCloud(data)
    const { items, deleted } = mergeKeyed<NoteType>(
      cloud.items,
      store.noteList,
      (note) => note.id,
      cloud.deleted,
      store.deleted,
    )
    store.noteList = items
    store.deleted = deleted
  },
})

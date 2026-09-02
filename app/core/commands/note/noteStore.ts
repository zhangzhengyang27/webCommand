import { defineStore } from 'pinia'
import { useCloudSync } from '../../../composables/useCloudSync'

/**
 * 速记条目
 */
export interface NoteType {
  id: string
  text: string
  createTime: string | Date
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8)

// 将云端返回的字符串日期还原为 Date 对象
function reviveNote(n: Record<string, unknown>): NoteType {
  return {
    id: String(n.id ?? ''),
    text: String(n.text ?? ''),
    createTime: n.createTime ? new Date(String(n.createTime)) : new Date(),
  }
}

/**
 * 速记状态（随手记一句话，登录后云同步）
 */
export const useNoteStore = defineStore('note', {
  state: () => ({
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
      this.syncToCloud()
      return true
    },
    clearNotes(): number {
      const count = this.noteList.length
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
      this.noteList = items.map(reviveNote)
      this.syncToCloud()
    },
  },
})

// 云同步实例（模块级单例；store 实例通过惰性调用获取，避免循环依赖）
const getStore = () => useNoteStore()

const cloudSync = useCloudSync('note', {
  serialize: () => getStore().noteList,
  merge: (data) => {
    if (!Array.isArray(data)) return
    const store = getStore()
    const cloudNotes: NoteType[] = data
      .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
      .map(reviveNote)
    const cloudIds = new Set(cloudNotes.map((n) => n.id))
    // 合并：云端条目（源为真）+ 本地独有条目（尚未同步到云端）
    const localOnly = store.noteList.filter((n) => !cloudIds.has(n.id))
    store.noteList = [...cloudNotes, ...localOnly]
  },
})

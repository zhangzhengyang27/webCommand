import { defineStore } from 'pinia'
import myAxios from '../../../utils/myAxios'
import { useUserStore } from '../user/userStore'

/**
 * 速记条目
 */
export interface NoteType {
  id: string
  text: string
  createTime: string | Date
}

// 云端同步防抖定时器
let syncTimer: ReturnType<typeof setTimeout> | undefined
// 已初始化云同步的用户 id 与订阅取消函数（换账号时需重新拉取云端数据并解除旧订阅）
let cloudSyncUserId: string | number | null = null
let unsubscribeCloudSync: (() => void) | null = null

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8)

// 将云端返回的字符串日期还原为 Date 对象
function reviveNote(n: any): NoteType {
  return {
    ...n,
    createTime: n.createTime ? new Date(n.createTime) : new Date(),
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
     * 同步到云端（防抖 800ms，未登录时跳过）
     */
    syncToCloud() {
      const userStore = useUserStore()
      if (!userStore.loginUser?.id) {
        return
      }
      if (syncTimer) {
        clearTimeout(syncTimer)
      }
      syncTimer = setTimeout(() => {
        myAxios
          .post('/data/sync', {
            type: 'note',
            content: JSON.stringify(this.noteList),
          })
          .catch((e) => console.error('note 同步失败', e))
      }, 800)
    },
    /**
     * 从云端加载，与本地未同步条目合并（按 id 去重）
     */
    async loadFromCloud() {
      const userStore = useUserStore()
      if (!userStore.loginUser?.id) {
        return
      }
      try {
        const res: any = await myAxios.get('/data?type=note')
        if (res?.code === 0 && res.data) {
          const list = JSON.parse(res.data)
          if (Array.isArray(list)) {
            const cloudNotes: NoteType[] = list.map(reviveNote)
            const cloudIds = new Set(cloudNotes.map((n) => n.id))
            const localOnly = this.noteList.filter((n) => !cloudIds.has(n.id))
            this.noteList = [...cloudNotes, ...localOnly]
          }
        }
      } catch (e) {
        console.error('note 云端加载失败', e)
      }
    },
    /**
     * 初始化云端同步：先拉取，再订阅后续变更（按用户幂等）
     */
    initCloudSync() {
      const userStore = useUserStore()
      const userId = userStore.loginUser?.id
      if (!userId) {
        return
      }
      if (cloudSyncUserId === userId) {
        return
      }
      this.resetCloudSync()
      cloudSyncUserId = userId
      this.loadFromCloud().finally(() => {
        unsubscribeCloudSync = this.$subscribe(() => this.syncToCloud())
      })
    },
    /**
     * 重置云同步：解除订阅并清除初始化标记（注销时调用）
     */
    resetCloudSync() {
      if (unsubscribeCloudSync) {
        unsubscribeCloudSync()
        unsubscribeCloudSync = null
      }
      cloudSyncUserId = null
    },
    /**
     * 从备份导入（覆盖当前数据）
     */
    importBackup(list: any[]) {
      this.noteList = (Array.isArray(list) ? list : []).filter((n) => n?.text).map(reviveNote)
      this.syncToCloud()
    },
  },
})

import { defineStore } from 'pinia'
import TaskType = Todo.TaskType
import myAxios from '../../../utils/myAxios'
import { useUserStore } from '../user/userStore'

// 云端同步防抖定时器
let syncTimer: ReturnType<typeof setTimeout> | undefined
// 已初始化云同步的用户 id 与订阅取消函数（换账号时需重新拉取云端数据并解除旧订阅，防止数据串写）
let cloudSyncUserId: string | number | null = null
let unsubscribeCloudSync: (() => void) | null = null

// 将云端返回的字符串日期还原为 Date 对象
function reviveTask(t: any): TaskType {
  return {
    ...t,
    createTime: t.createTime ? new Date(t.createTime) : new Date(),
    finishTime: t.finishTime ? new Date(t.finishTime) : undefined,
  }
}

/**
 * 生成短唯一 ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * 任务筛选条件
 */
export type TaskFilter = 'all' | 'todo' | 'done'

/**
 * 空间状态（类似文件系统实现）
 */
export const useTodoStore = defineStore('todo', {
  state: () => ({
    // 当前列表筛选条件（供 delete 按显示序号定位到真实任务）
    currentFilter: 'all' as TaskFilter,
    // 任务列表
    taskList: [
      {
        id: generateId(),
        name: '写下你要做的事',
        isFinished: false,
        createTime: new Date(),
      },
      {
        id: generateId(),
        name: '已完成的事项',
        isFinished: true,
        createTime: new Date(),
        finishTime: new Date(),
      },
    ] as TaskType[],
  }),
  getters: {
    /**
     * 按状态筛选任务
     */
    filteredTaskList: (state) => {
      return (filter: TaskFilter = 'all') => {
        if (filter === 'todo') {
          return state.taskList.filter((task) => !task.isFinished)
        }
        if (filter === 'done') {
          return state.taskList.filter((task) => task.isFinished)
        }
        return state.taskList
      }
    },
    /**
     * 任务统计
     */
    stats: (state) => {
      const total = state.taskList.length
      const done = state.taskList.filter((task) => task.isFinished).length
      const todo = total - done
      return { total, done, todo }
    },
  },
  // 持久化
  persist: {
    key: 'todo-store',
    storage: window.localStorage,
    beforeRestore: (_context) => {
      console.log('加载待办数据开始')
    },
    afterRestore: (_context) => {
      console.log('加载待办数据结束')
    },
  },
  actions: {
    /**
     * 创建任务
     * @param task
     */
    addTask(task: TaskType) {
      if (!task || !task.name) {
        return false
      }
      this.taskList.push({
        id: task.id || generateId(),
        name: task.name,
        isFinished: false,
        createTime: new Date(),
      })
      return true
    },
    /**
     * 根据 ID 删除任务
     * @param id
     */
    deleteTaskById(id: string) {
      const index = this.taskList.findIndex((task) => task.id === id)
      if (index === -1) {
        return false
      }
      this.taskList.splice(index, 1)
      return true
    },
    /**
     * 更新任务
     * @param index
     * @param newTask
     */
    updateTask(index: number, newTask: Partial<TaskType>) {
      if (index < 0 || index >= this.taskList.length) {
        return false
      }
      const task = this.taskList[index]!
      // 状态切换时自动维护完成时间
      if (newTask.isFinished !== undefined && newTask.isFinished && !task.isFinished) {
        newTask.finishTime = new Date()
      }
      if (newTask.isFinished === false) {
        newTask.finishTime = undefined
      }
      this.taskList[index] = { ...task, ...newTask } as TaskType
      return true
    },
    /**
     * 根据 ID 切换任务完成状态
     * @param id
     */
    toggleTaskById(id: string) {
      const index = this.taskList.findIndex((task) => task.id === id)
      if (index === -1) {
        return false
      }
      const task = this.taskList[index]!
      return this.updateTask(index, { isFinished: !task.isFinished })
    },
    /**
     * 根据 ID 完成任务
     * @param id
     */
    finishTaskById(id: string) {
      const index = this.taskList.findIndex((task) => task.id === id)
      if (index === -1) {
        return false
      }
      return this.updateTask(index, { isFinished: true })
    },
    /**
     * 清空所有任务
     */
    clearAll() {
      this.taskList = []
    },
    /**
     * 清空已完成任务
     */
    clearFinished() {
      this.taskList = this.taskList.filter((task) => !task.isFinished)
    },
    /**
     * 同步到云端（登录后）(#24)
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
            type: 'todo',
            content: JSON.stringify(this.taskList),
          })
          .catch((e) => console.error('todo 同步失败', e))
      }, 800)
    },
    /**
     * 从云端加载，与本地未同步任务合并（避免覆盖丢失）(#24)
     */
    async loadFromCloud() {
      const userStore = useUserStore()
      if (!userStore.loginUser?.id) {
        return
      }
      try {
        const res: any = await myAxios.get('/data?type=todo')
        if (res?.code === 0 && res.data) {
          const list = JSON.parse(res.data)
          if (Array.isArray(list)) {
            const cloudTasks: TaskType[] = list.map(reviveTask)
            const cloudIds = new Set(cloudTasks.map((t) => t.id))
            // 合并：云端任务（源为真）+ 本地独有任务（尚未同步到云端）
            const localOnly = this.taskList.filter((t) => !cloudIds.has(t.id))
            this.taskList = [...cloudTasks, ...localOnly]
          }
        }
      } catch (e) {
        console.error('todo 加载失败', e)
      }
    },
    /**
     * 初始化云端同步：先拉取，再订阅后续变更 (#24)
     * 按用户幂等：同一用户重复调用不重复注册 $subscribe；换用户时先解除旧订阅再重新拉取
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
        unsubscribeCloudSync = this.$subscribe((_mutation, _state) => this.syncToCloud())
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
      this.taskList = (Array.isArray(list) ? list : []).filter((t) => t?.name).map(reviveTask)
      this.syncToCloud()
    },
  },
})

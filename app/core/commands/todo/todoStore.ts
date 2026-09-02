import { defineStore } from 'pinia'
import TaskType = Todo.TaskType
import { useCloudSync } from '../../../composables/useCloudSync'

// 将云端返回的字符串日期还原为 Date 对象
function reviveTask(t: Record<string, unknown>): TaskType {
  return {
    id: String(t.id ?? ''),
    name: String(t.name ?? ''),
    isFinished: Boolean(t.isFinished),
    createTime: t.createTime ? new Date(String(t.createTime)) : new Date(),
    finishTime: t.finishTime ? new Date(String(t.finishTime)) : undefined,
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
      cloudSync.initCloudSync(() => this.$subscribe((_mutation, _state) => this.syncToCloud()))
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
        (t): t is Record<string, unknown> => typeof t === 'object' && t !== null && 'name' in t,
      )
      this.taskList = items.map(reviveTask)
      this.syncToCloud()
    },
  },
})

// 云同步实例（模块级单例；store 实例通过惰性调用获取，避免循环依赖）
const getStore = () => useTodoStore()

const cloudSync = useCloudSync('todo', {
  serialize: () => getStore().taskList,
  merge: (data) => {
    if (!Array.isArray(data)) return
    const store = getStore()
    const cloudTasks: TaskType[] = data
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
      .map(reviveTask)
    const cloudIds = new Set(cloudTasks.map((t) => t.id))
    // 合并：云端任务（源为真）+ 本地独有任务（尚未同步到云端）
    const localOnly = store.taskList.filter((t) => !cloudIds.has(t.id))
    store.taskList = [...cloudTasks, ...localOnly]
  },
})

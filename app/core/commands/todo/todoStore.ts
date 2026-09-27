import { defineStore } from 'pinia'
import TaskType = Todo.TaskType
import { useCloudSync } from '../../../composables/useCloudSync'
import { clearDeleted, mergeKeyed, pruneTombstones } from '../../../composables/cloudMerge'

// 将云端返回的字符串日期还原为 Date 对象
function reviveTask(t: Record<string, unknown>): TaskType {
  return {
    id: String(t.id ?? ''),
    name: String(t.name ?? ''),
    isFinished: Boolean(t.isFinished),
    createTime: t.createTime ? new Date(String(t.createTime)) : new Date(),
    finishTime: t.finishTime ? new Date(String(t.finishTime)) : undefined,
    updateTime: typeof t.updateTime === 'number' ? t.updateTime : undefined,
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

/** 云端 todo 的数据结构；历史数据为裸数组，合并时按旧结构兜底 */
interface TodoCloudShape {
  items: TaskType[]
  /** 已删除任务墓碑（id -> 删除时刻），用于阻止另一端把任务合并回来 */
  deleted: Record<string, number>
}

/** 解析云端内容，兼容旧版裸数组格式 */
function parseCloud(data: unknown): TodoCloudShape {
  if (Array.isArray(data)) return { items: data as TaskType[], deleted: {} }
  if (data && typeof data === 'object') {
    const obj = data as { items?: unknown; deleted?: unknown }
    return {
      items: Array.isArray(obj.items) ? (obj.items as TaskType[]) : [],
      deleted:
        obj.deleted && typeof obj.deleted === 'object'
          ? (obj.deleted as Record<string, number>)
          : {},
    }
  }
  return { items: [], deleted: {} }
}

export const useTodoStore = defineStore('todo', {
  state: () => ({
    // 当前列表筛选条件（供 delete 按显示序号定位到真实任务）
    currentFilter: 'all' as TaskFilter,
    // 已删除任务墓碑（id -> 删除时刻）
    deleted: {} as Record<string, number>,
    // 任务列表（首次使用为空；原先内置的两条演示任务会随同步写进云端，每台新设备都留两条垃圾）
    taskList: [] as TaskType[],
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
      const now = Date.now()
      this.taskList.push({
        id: task.id || generateId(),
        name: task.name,
        isFinished: false,
        createTime: new Date(),
        updateTime: now,
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
      this.deleted[id] = Date.now()
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
      this.taskList[index] = { ...task, ...newTask, updateTime: Date.now() } as TaskType
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
      this.tombstoneAll(this.taskList)
      this.taskList = []
    },
    /**
     * 清空已完成任务
     */
    clearFinished() {
      this.tombstoneAll(this.taskList.filter((task) => task.isFinished))
      this.taskList = this.taskList.filter((task) => !task.isFinished)
    },
    /**
     * 为一批任务留下删除墓碑，防止其它设备把它们重新合并回来
     */
    tombstoneAll(tasks: TaskType[]) {
      const now = Date.now()
      for (const task of tasks) this.deleted[task.id] = now
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
      const now = Date.now()
      this.taskList = items.map((t) => {
        const task = reviveTask(t)
        // 导入即恢复：改到最新时间并清掉墓碑，避免被历史删除记录再次消掉
        task.updateTime = now
        clearDeleted(this.deleted, task.id)
        return task
      })
      this.syncToCloud()
    },
  },
})

// 云同步实例（模块级单例；store 实例通过惰性调用获取，避免循环依赖）
const getStore = () => useTodoStore()

const cloudSync = useCloudSync('todo', {
  serialize: () => ({
    items: getStore().taskList,
    deleted: pruneTombstones(getStore().deleted),
  }),
  merge: (data) => {
    const store = getStore()
    const cloud = parseCloud(data)
    const { items, deleted } = mergeKeyed<TaskType>(
      cloud.items,
      store.taskList,
      (task) => task.id,
      cloud.deleted,
      store.deleted,
    )
    store.taskList = items
    store.deleted = deleted
  },
})

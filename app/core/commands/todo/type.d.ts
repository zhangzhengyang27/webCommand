declare namespace Todo {
  /**
   * 任务类型
   */
  interface TaskType {
    id: string
    name: string
    isFinished: boolean
    createTime: Date
    finishTime?: Date
  }
}

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
    /**
     * 最后修改时刻（毫秒），跨设备合并时同 id 冲突以此判定谁胜出；
     * 历史数据无该字段，按 0 处理（即任何本地改动都优先于旧云端数据）
     */
    updateTime?: number
  }
}

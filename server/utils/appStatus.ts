/** 运行期可观测状态：供 /api/health 暴露，避免"启动成功但schema没建起来"这种静默半死状态 */
export const appStatus = {
  schemaReady: false,
  schemaError: '',
}

export function setSchemaStatus(ready: boolean, error = ''): void {
  appStatus.schemaReady = ready
  appStatus.schemaError = error
}

/**
 * 云同步注册表：所有参与云端同步的数据类型的唯一清单。
 *
 * 页面加载（自动登录）、交互式登录、注销三处都遍历这份列表，
 * 避免「新增一个 store 忘了在某处 init」——那会导致云端数据从不拉取，
 * 且下一次本地改动把云端整包覆盖掉。
 *
 * 类型名同时是服务端 /api/data 的白名单取值，两处需一致（有契约测试兜底）。
 */

/** 参与云同步的数据类型 */
export const CLOUD_DATA_TYPES = [
  'todo',
  'space',
  'note',
  'custom',
  'terminalConfig',
  'theme',
] as const

export type CloudDataType = (typeof CLOUD_DATA_TYPES)[number]

interface CloudSyncCapable {
  initCloudSync: () => void
  resetCloudSync: () => void
}

/** 懒加载各 store：未登录时这些数据模块不进主包 */
const loaders: Record<CloudDataType, () => Promise<CloudSyncCapable>> = {
  todo: async () => (await import('../core/commands/todo/todoStore')).useTodoStore(),
  space: async () => (await import('../core/commands/space/spaceStore')).useSpaceStore(),
  note: async () => (await import('../core/commands/note/noteStore')).useNoteStore(),
  custom: async () => (await import('../core/commands/custom/customStore')).useCustomCommandStore(),
  terminalConfig: async () =>
    (await import('../core/commands/terminal/config/terminalConfigStore')).useTerminalConfigStore(),
  theme: async () => (await import('../core/commands/theme/themeStore')).useThemeStore(),
}

/** 登录后初始化全部数据云同步（各自先拉取云端，再订阅本地变更） */
export async function initAllCloudSync() {
  for (const type of CLOUD_DATA_TYPES) {
    try {
      ;(await loaders[type]()).initCloudSync()
    } catch (e) {
      console.error(`${type} 云同步初始化失败`, e)
    }
  }
}

/** 注销时解除全部云同步订阅，避免注销后的本地变更继续上云 */
export async function resetAllCloudSync() {
  for (const type of CLOUD_DATA_TYPES) {
    try {
      ;(await loaders[type]()).resetCloudSync()
    } catch (e) {
      console.error(`${type} 云同步解除失败`, e)
    }
  }
}

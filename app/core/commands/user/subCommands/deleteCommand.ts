import type { CommandType } from '../../../command'
import { userDelete } from '../userApi'
import { useUserStore } from '../userStore'
import { LOCAL_USER } from '../userConstant'
import { resetAllCloudSync } from '../../../../composables/cloudSyncRegistry'
import { errMsg } from '../../../../utils/error'

/**
 * 注销账号命令（不可恢复）
 *
 * 要求带与用户名完全一致的 --confirm：这条命令会删掉云端全部数据，
 * 只靠"用户已经登录"不足以证明他确实想删，多打一遍用户名是最便宜的防误触。
 */
const deleteCommand: CommandType = {
  func: 'delete',
  name: '注销账号',
  desc: '删除账号及其全部云端数据，不可恢复',
  options: [
    {
      key: 'password',
      desc: '当前登录密码（服务端会再次校验）',
      alias: ['p'],
      type: 'string',
      required: true,
    },
    {
      key: 'confirm',
      desc: '确认串，必须与当前用户名完全一致',
      alias: ['c'],
      type: 'string',
    },
  ],
  async action(options, terminal) {
    const userStore = useUserStore()
    const { loginUser } = userStore
    if (!loginUser || loginUser.username === LOCAL_USER.username) {
      terminal.writeTextErrorResult('未登录，请先执行 user login 登录')
      return
    }
    const username = loginUser.username
    const password = options.password ? String(options.password) : ''
    const confirm = options.confirm ? String(options.confirm) : ''
    if (!password) {
      terminal.writeTextErrorResult(`用法：user delete -p <当前密码> --confirm ${username}`)
      return
    }
    if (confirm !== username) {
      terminal.writeTextErrorResult(
        `注销会删除账号与全部云端数据且不可恢复。确认无误请执行：user delete -p <当前密码> --confirm ${username}`,
      )
      return
    }
    try {
      const res = await userDelete(password, confirm)
      if (res?.code === 0) {
        // 先解除云同步订阅，再清本地登录态，避免注销后的本地变更继续上云
        await resetAllCloudSync()
        userStore.setLoginUser(LOCAL_USER)
        terminal.writeTextSuccessResult('账号已注销，云端数据已删除')
      } else {
        terminal.writeTextErrorResult(res?.message ?? '注销失败')
      }
    } catch (e) {
      terminal.writeTextErrorResult(errMsg(e))
    }
  },
}

export default deleteCommand

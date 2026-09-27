import type { CommandType } from '../../../command'
import { userLogout } from '../userApi'
import { useUserStore } from '../userStore'
import { LOCAL_USER } from '../userConstant'
import { resetAllCloudSync } from '../../../../composables/cloudSyncRegistry'

/**
 * 用户注销命令
 * @author yupi
 */
const logoutCommand: CommandType = {
  func: 'logout',
  name: '用户注销',
  options: [],
  async action(options, terminal) {
    const res = await userLogout()
    const { setLoginUser } = useUserStore()
    if (res?.code === 0) {
      // 注销时解除全部数据类型的云同步订阅，避免注销后的本地变更继续上云
      await resetAllCloudSync()
      setLoginUser(LOCAL_USER)
      terminal.writeTextSuccessResult('已退出登录')
    } else {
      terminal.writeTextErrorResult(res?.message ?? '注销失败')
    }
  },
}

export default logoutCommand

import type { CommandType } from '../../../command'
import { userLogout } from '../userApi'
import { useUserStore } from '../userStore'
import { LOCAL_USER } from '../userConstant'
import { useTodoStore } from '../../todo/todoStore'
import { useSpaceStore } from '../../space/spaceStore'
import { useNoteStore } from '../../note/noteStore'

/**
 * 用户注销命令
 * @author yupi
 */
const logoutCommand: CommandType = {
  func: 'logout',
  name: '用户注销',
  options: [],
  async action(options, terminal) {
    const res: any = await userLogout()
    const { setLoginUser } = useUserStore()
    if (res?.code === 0) {
      // 注销时解除 todo/space/note 的云端同步订阅，避免注销后的本地变更继续同步
      useTodoStore().resetCloudSync()
      useSpaceStore().resetCloudSync()
      useNoteStore().resetCloudSync()
      setLoginUser(LOCAL_USER)
      terminal.writeTextSuccessResult('已退出登录')
    } else {
      terminal.writeTextErrorResult(res?.message ?? '注销失败')
    }
  },
}

export default logoutCommand

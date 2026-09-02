import type { CommandType } from '../../../command'
import { updateUserPassword } from '../userApi'
import { useUserStore } from '../userStore'
import { LOCAL_USER } from '../userConstant'
import { errMsg } from '../../../../utils/error'

/**
 * 修改密码命令（需登录并验证旧密码）
 */
const passwdCommand: CommandType = {
  func: 'passwd',
  name: '修改密码',
  desc: '修改当前登录用户的密码',
  options: [
    {
      key: 'oldPassword',
      desc: '旧密码',
      alias: ['o'],
      type: 'string',
      required: true,
    },
    {
      key: 'newPassword',
      desc: '新密码（至少 6 位）',
      alias: ['n'],
      type: 'string',
      required: true,
    },
  ],
  async action(options, terminal) {
    const { oldPassword, newPassword } = options
    if (!oldPassword || !newPassword) {
      terminal.writeTextErrorResult('用法：passwd -o <旧密码> -n <新密码>')
      return
    }
    if (String(newPassword).length < 6) {
      terminal.writeTextErrorResult('新密码至少 6 位')
      return
    }
    const { loginUser } = useUserStore()
    if (!loginUser || loginUser.username === LOCAL_USER.username) {
      terminal.writeTextErrorResult('未登录，请先执行 user login 登录')
      return
    }
    try {
      const res = await updateUserPassword(String(oldPassword), String(newPassword))
      if (res?.code === 0) {
        terminal.writeTextSuccessResult('密码修改成功')
      } else {
        terminal.writeTextErrorResult(res?.message ?? '修改失败')
      }
    } catch (e) {
      terminal.writeTextErrorResult(errMsg(e))
    }
  },
}

export default passwdCommand

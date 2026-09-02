import type { CommandType } from '../../../command'
import { userLogin, userRegister } from '../userApi'
import { useUserStore } from '../userStore'

/**
 * 用户注册命令
 * @author yupi
 */
const registerCommand: CommandType = {
  func: 'register',
  name: '用户注册',
  options: [
    {
      key: 'username',
      desc: '用户名',
      alias: ['u'],
      type: 'string',
      required: true,
    },
    {
      key: 'password',
      desc: '密码',
      alias: ['p'],
      type: 'string',
      required: true,
    },
    {
      key: 'email',
      desc: '邮箱',
      alias: ['e'],
      type: 'string',
      required: true,
    },
  ],
  async action(options, terminal) {
    const { username, password, email } = options
    if (!username) {
      terminal.writeTextErrorResult('请输入用户名')
      return
    }
    if (!password) {
      terminal.writeTextErrorResult('请输入密码')
      return
    }
    if (!email) {
      terminal.writeTextErrorResult('请输入邮箱')
      return
    }
    const res = await userRegister(username, password, email)
    if (res?.code === 0) {
      // 注册成功后自动登录
      const loginRes = await userLogin(username, password)
      const { setLoginUser } = useUserStore()
      if (loginRes?.code === 0 && loginRes.data) {
        setLoginUser(loginRes.data)
        terminal.writeTextSuccessResult('注册成功，已自动登录')
      } else {
        terminal.writeTextSuccessResult('注册成功，请手动登录')
      }
    } else {
      terminal.writeTextErrorResult(res?.message ?? '注册失败')
    }
  },
}

export default registerCommand

import { defineStore } from 'pinia'
import { getLoginUser } from './userApi'
import { LOCAL_USER } from './userConstant'
import { errMsg } from '../../../utils/error'
import UserType = User.UserType

/**
 * 用户系统
 */
export const useUserStore = defineStore('user', {
  state: () => ({
    loginUser: {
      ...LOCAL_USER,
    },
  }),
  getters: {},
  actions: {
    async getAndSetLoginUser() {
      try {
        const res = await getLoginUser()
        if (res?.code === 0 && res.data) {
          this.loginUser = res.data
        } else if (res?.code === 40100) {
          // 本地用户无服务端会话（code 40100），静默跳过，保持 LOCAL_USER 默认态
          this.$reset()
        } else {
          console.error('获取登录用户失败', res?.message)
          this.$reset()
        }
      } catch (error) {
        // 401（未登录）属预期路径，静默处理；其他错误才上日志
        const msg = errMsg(error)
        if (!msg.includes('未登录')) {
          console.error('获取登录用户异常', msg)
        }
        this.$reset()
      }
    },
    setLoginUser(user: UserType) {
      this.loginUser = user
    },
  },
})

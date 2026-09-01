import { defineStore } from "pinia";
import { getLoginUser } from "./userApi";
import { LOCAL_USER } from "./userConstant";
import UserType = User.UserType;

/**
 * 用户系统
 */
export const useUserStore = defineStore("user", {
  state: () => ({
    loginUser: {
      ...LOCAL_USER,
    },
  }),
  getters: {},
  actions: {
    async getAndSetLoginUser() {
      try {
        const res: any = await getLoginUser();
        if (res?.code === 0 && res.data) {
          this.loginUser = res.data;
        } else {
          console.error("获取登录用户失败", res?.message);
          this.$reset();
        }
      } catch (error: any) {
        console.error("获取登录用户异常", error?.message || error);
        this.$reset();
      }
    },
    setLoginUser(user: UserType) {
      this.loginUser = user;
    },
  },
});

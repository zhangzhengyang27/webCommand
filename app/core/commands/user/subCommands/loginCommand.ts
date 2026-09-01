import { CommandType } from "../../../command";
import { userLogin, userRegister } from "../userApi";
import { useUserStore } from "../userStore";

/**
 * 用户登录命令
 * @author yupi
 */
const loginCommand: CommandType = {
  func: "login",
  name: "用户登录",
  options: [
    {
      key: "username",
      desc: "用户名",
      alias: ["u"],
      type: "string",
      required: true,
    },
    {
      key: "password",
      desc: "密码",
      alias: ["p"],
      type: "string",
      required: true,
    },
    {
      key: "remember",
      desc: "记住我（自动登录），默认开启",
      alias: ["r"],
      type: "boolean",
      defaultValue: true,
    },
  ],
  async action(options, terminal) {
    const { username, password, remember } = options;
    if (!username) {
      terminal.writeTextErrorResult("请输入用户名");
      return;
    }
    if (!password) {
      terminal.writeTextErrorResult("请输入密码");
      return;
    }
    const res: any = await userLogin(username, password, remember !== false);
    const { setLoginUser } = useUserStore();
    if (res?.code === 0) {
      setLoginUser(res.data);
      terminal.writeTextSuccessResult(
        remember !== false ? "登录成功（已开启自动登录）" : "登录成功",
      );
      // 登录成功后初始化 todo / space / note 云端同步 (#24 #25)
      const { useTodoStore } = await import("../../todo/todoStore");
      const { useSpaceStore } = await import("../../space/spaceStore");
      const { useNoteStore } = await import("../../note/noteStore");
      useTodoStore().initCloudSync();
      useSpaceStore().initCloudSync();
      useNoteStore().initCloudSync();
    } else {
      terminal.writeTextErrorResult(res?.message ?? "登录失败");
    }
  },
};

export default loginCommand;

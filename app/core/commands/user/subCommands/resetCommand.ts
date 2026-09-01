import { CommandType } from "../../../command";
import { resetPassword, sendResetCode } from "../userApi";

/**
 * 找回密码命令（邮箱验证码两步流程）
 * 第一步：reset -e <邮箱>           发送验证码
 * 第二步：reset -e <邮箱> -c <验证码> -n <新密码>  重置密码
 */
const resetCommand: CommandType = {
  func: "reset",
  name: "找回密码",
  desc: "通过邮箱验证码重置密码",
  options: [
    {
      key: "email",
      desc: "注册邮箱",
      alias: ["e"],
      type: "string",
      required: true,
    },
    {
      key: "code",
      desc: "邮箱验证码",
      alias: ["c"],
      type: "string",
    },
    {
      key: "newPassword",
      desc: "新密码（至少 6 位）",
      alias: ["n"],
      type: "string",
    },
  ],
  async action(options, terminal) {
    const { email, code, newPassword } = options;
    if (!email) {
      terminal.writeTextErrorResult(
        "用法：\n1. reset -e <邮箱> 发送验证码\n2. reset -e <邮箱> -c <验证码> -n <新密码> 重置密码",
      );
      return;
    }
    // 第一步：只传邮箱 => 发送验证码
    if (!code || !newPassword) {
      try {
        const res: any = await sendResetCode(String(email));
        if (res?.code === 0) {
          terminal.writeTextSuccessResult(
            `验证码已发送至 ${email}，10 分钟内有效`,
          );
          terminal.writeTextResult(
            "收到验证码后执行：reset -e <邮箱> -c <验证码> -n <新密码>",
          );
        } else {
          terminal.writeTextErrorResult(res?.message ?? "验证码发送失败");
        }
      } catch (e: any) {
        terminal.writeTextErrorResult(e?.message ?? "验证码发送失败");
      }
      return;
    }
    // 第二步：验证码 + 新密码 => 重置
    if (String(newPassword).length < 6) {
      terminal.writeTextErrorResult("新密码至少 6 位");
      return;
    }
    try {
      const res: any = await resetPassword(
        String(email),
        String(code),
        String(newPassword),
      );
      if (res?.code === 0) {
        terminal.writeTextSuccessResult("密码重置成功，请使用新密码登录");
      } else {
        terminal.writeTextErrorResult(res?.message ?? "重置失败");
      }
    } catch (e: any) {
      terminal.writeTextErrorResult(e?.message ?? "重置失败");
    }
  },
};

export default resetCommand;

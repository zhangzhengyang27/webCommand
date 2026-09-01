import { CommandType } from "../../command";

/**
 * Base64 编解码命令（UTF-8 安全）
 */
const b64Command: CommandType = {
  func: "b64",
  name: "Base64 编解码",
  alias: ["base64"],
  desc: "Base64 编码 / 解码文本",
  params: [
    {
      key: "text",
      desc: "文本",
      required: true,
    },
  ],
  options: [
    {
      key: "decode",
      desc: "解码模式",
      alias: ["d"],
      type: "boolean",
    },
  ],
  action(options, terminal) {
    const { _, decode } = options;
    const text = _.join(" ");
    if (!text) {
      terminal.writeTextErrorResult("用法：b64 <文本> 编码；b64 -d <Base64> 解码");
      return;
    }
    try {
      if (decode) {
        const bytes = Uint8Array.from(
          atob(text.trim()),
          (c) => c.charCodeAt(0),
        );
        terminal.writeTextSuccessResult(new TextDecoder().decode(bytes));
      } else {
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        for (const b of bytes) {
          binary += String.fromCharCode(b);
        }
        terminal.writeTextSuccessResult(btoa(binary));
      }
    } catch (e) {
      terminal.writeTextErrorResult("操作失败：输入不是合法的 Base64 或文本");
    }
  },
};

export default b64Command;

import { CommandType } from "../../command";

/**
 * 时间戳转换命令：当前时间戳 / 时间戳转日期 / 日期转时间戳
 */
const tsCommand: CommandType = {
  func: "ts",
  name: "时间戳转换",
  alias: ["timestamp", "时间戳"],
  desc: "查看当前时间戳，或与日期互转",
  options: [
    {
      key: "unix",
      desc: "把秒/毫秒时间戳转为日期",
      alias: ["u"],
      type: "string",
    },
    {
      key: "date",
      desc: "把日期转为时间戳",
      alias: ["d"],
      type: "string",
    },
  ],
  action(options, terminal) {
    const { unix, date } = options;
    if (unix) {
      const n = Number(unix);
      if (!Number.isFinite(n)) {
        terminal.writeTextErrorResult("时间戳必须是数字");
        return;
      }
      // 13 位视为毫秒，10 位视为秒
      const ms = Math.abs(n) > 1e12 ? n : n * 1000;
      const d = new Date(ms);
      if (isNaN(d.getTime())) {
        terminal.writeTextErrorResult("无法识别的时间戳");
        return;
      }
      terminal.writeTextSuccessResult(
        `${d.toLocaleString()}\nISO：${d.toISOString()}`,
      );
      return;
    }
    if (date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        terminal.writeTextErrorResult("无法识别的日期，示例：2026-01-01 08:00");
        return;
      }
      terminal.writeTextSuccessResult(
        `秒：${Math.floor(d.getTime() / 1000)}\n毫秒：${d.getTime()}`,
      );
      return;
    }
    const now = Date.now();
    terminal.writeTextSuccessResult(
      `秒：${Math.floor(now / 1000)}\n毫秒：${now}\nISO：${new Date().toISOString()}\n本地：${new Date().toLocaleString()}`,
    );
  },
};

export default tsCommand;

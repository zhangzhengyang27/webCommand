import { CommandType } from "../../command";
import { useThemeStore } from "./themeStore";

/**
 * 主题切换命令
 * @author m4tt72 (ported)
 */
const themeCommand: CommandType = {
  func: "theme",
  name: "切换主题",
  alias: ["zt", "zhuti", "主题"],
  desc: "列出或设置终端配色主题",
  params: [
    {
      key: "subCommand",
      desc: "子命令：ls / set",
      required: false,
    },
    {
      key: "themeName",
      desc: "主题名称",
      required: false,
    },
  ],
  options: [],
  action(options, terminal) {
    const { _ } = options;
    const { themeNames, setTheme, currentTheme } = useThemeStore();
    const subCommand = _[0];

    if (!subCommand || subCommand === "ls" || subCommand === "list") {
      terminal.writeTextResult(
        `当前主题：${currentTheme.name}\n可用主题：\n${themeNames
          .map((name) => `  ${name}`)
          .join("\n")}`,
      );
      return;
    }

    if (subCommand === "set") {
      const themeName = _[1];
      if (!themeName) {
        terminal.writeTextErrorResult("请指定主题名，例如：theme set Dracula");
        return;
      }
      const success = setTheme(themeName);
      if (success) {
        terminal.writeTextSuccessResult(`主题已切换为 ${themeName}`);
      } else {
        terminal.writeTextErrorResult(
          `未找到主题 '${themeName}'，使用 'theme ls' 查看可用主题`,
        );
      }
      return;
    }

    terminal.writeTextResult(
      "用法：\n  theme ls      列出所有主题\n  theme set <主题名>  切换主题",
    );
  },
};

export default themeCommand;

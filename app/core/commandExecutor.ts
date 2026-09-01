import * as getoptsNamespace from "getopts";
const getopts: (
  argv: string[],
  options?: getoptsNamespace.Options,
) => getoptsNamespace.ParsedOptions =
  (getoptsNamespace as any).default || getoptsNamespace;
import { commandMap } from "./commandRegister";
import { CommandOptionType, CommandType } from "./command";
import TerminalType = YuTerminal.TerminalType;
import helpCommand from "./commands/terminal/help/helpCommand";
import { useCustomCommandStore } from "./commands/custom/customStore";

/**
 * 执行命令
 * @param text 输入字符串
 * @param terminal 终端
 * @param parentCommand
 */
export const doCommandExecute = async (
  text: string,
  terminal: TerminalType,
  parentCommand?: CommandType,
  depth = 0,
) => {
  // 防止子命令无限递归
  if (depth > 10) {
    terminal.writeTextErrorResult("命令层级过深");
    return;
  }
  // 去除命令首尾空格
  text = text.trim();
  if (!text) {
    return;
  }
  // 解析文本，得到命令
  const command: CommandType = getCommand(text, parentCommand);
  if (!command) {
    // 自定义命令回退：输入的名称匹配用户自定义的快捷命令时，执行其对应文本 (#73)
    const token = text.split(" ", 1)[0].toLowerCase();
    const customText = useCustomCommandStore().getCustom(token);
    if (customText) {
      // 保留自定义命令名之后追加的参数，如 g google.com => goto google.com
      const restArgs = text.slice(token.length).trim();
      await doCommandExecute(
        restArgs ? `${customText} ${restArgs}` : customText,
        terminal,
        undefined,
        depth + 1,
      );
      return;
    }
    terminal.writeTextErrorResult("找不到命令");
    return;
  }
  // 解析参数（需传递不同的解析规则）
  const parsedOptions = doParse(text, command.options);
  const { _ } = parsedOptions;
  // 有子命令，执行
  if (
    _.length > 0 &&
    command.subCommands &&
    Object.keys(command.subCommands).length > 0
  ) {
    // 把子命令当做新命令解析，user login xxx => login xxx
    const spaceIndex = text.indexOf(" ");
    const subText = spaceIndex > -1 ? text.substring(spaceIndex + 1) : "";
    await doCommandExecute(subText, terminal, command, depth + 1);
    return;
  }
  // 执行命令
  await doAction(command, parsedOptions, terminal, parentCommand);
};

/**
 * 获取命令（匹配）
 * @param text
 * @param parentCommand
 */
const getCommand = (text: string, parentCommand?: CommandType): CommandType => {
  let func = text.split(" ", 1)[0];
  func = func.toLowerCase(); // 大小写无关
  let commands = commandMap;
  // 有父命令，则从父命令中查找
  if (
    parentCommand &&
    parentCommand.subCommands &&
    Object.keys(parentCommand.subCommands).length > 0
  ) {
    commands = parentCommand.subCommands;
  }
  const command = commands[func];
  if (command) {
    return command;
  }
  // 子命令别名解析（顶层命令已在注册时包含别名，此处主要服务子命令）
  for (const key in commands) {
    const cmd = commands[key];
    if (cmd?.alias?.map((a) => a.toLowerCase()).includes(func)) {
      return cmd;
    }
  }
  return undefined as unknown as CommandType;
};

/**
 * 解析参数
 *
 * @param text
 * @param commandOptions
 */
const doParse = (
  text: string,
  commandOptions: CommandOptionType[],
): getoptsNamespace.ParsedOptions => {
  // 过滤掉关键词，支持多个连续空格
  const args: string[] = text.split(/\s+/).slice(1).filter(Boolean);
  // 转换
  const options: getoptsNamespace.Options = {
    alias: {},
    default: {},
    string: [],
    boolean: [],
  };
  commandOptions.forEach((commandOption) => {
    const { alias, key, type, defaultValue } = commandOption;
    if (alias && options.alias) {
      options.alias[key] = alias;
    }
    options[type === "boolean" ? "boolean" : "string"]?.push(key);
    if (defaultValue && options.default) {
      options.default[key] = defaultValue;
    }
  });
  const parsedOptions = getopts(args, options);
  return parsedOptions;
};

/**
 * 执行
 * @param command
 * @param options
 * @param terminal
 * @param parentCommand
 */
const doAction = async (
  command: CommandType,
  options: getoptsNamespace.ParsedOptions,
  terminal: TerminalType,
  parentCommand?: CommandType,
) => {
  const { help } = options;
  // 设置输出折叠
  if (command.collapsible || help) {
    terminal.setCommandCollapsible(true);
  }
  // 查看帮助
  // e.g. xxx --help => { _: ["xxx"] }
  if (help) {
    const newOptions = { ...options, _: [command.func] };
    try {
      await helpCommand.action(newOptions, terminal, parentCommand);
    } catch (e: any) {
      terminal.writeTextErrorResult(e?.message || "帮助命令执行出错");
      console.error(e);
    }
    return;
  }
  try {
    await command.action(options, terminal, parentCommand);
  } catch (e: any) {
    terminal.writeTextErrorResult(e?.message || "命令执行出错");
    console.error(e);
  }
};

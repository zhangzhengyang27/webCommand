import { ref } from "vue";
import { getUsageStr } from "../../core/commands/terminal/help/helpUtils";
import { commandMap } from "../../core/commandRegister";
import { CommandType } from "../../core/command";
import debounce from "lodash/debounce";
import trim from "lodash/trim";
import { useTerminalConfigStore } from "../../core/commands/terminal/config/terminalConfigStore";

/**
 * 命令提示与 Tab 自动补全功能
 * @author zhangzhengang
 */
const useHint = () => {
  const hint = ref("");
  const { showHint } = useTerminalConfigStore();
  // Tab 循环索引，用于多匹配时循环切换候选
  let tabCycleIndex = 0;

  /**
   * 获取输入词元（去掉首尾空格）
   */
  const getTokens = (inputText: string): string[] => {
    return trim(inputText)
      .split(/\s+/)
      .filter((token) => token.length > 0);
  };

  /**
   * 获取命令的所有可用名称（func + alias）
   */
  const getCommandNames = (command: CommandType): string[] => {
    return [command.func, ...(command.alias ?? [])];
  };

  /**
   * 获取所有已注册命令名称（去重）
   */
  const getAllCommandNames = (): string[] => {
    const names = new Set<string>();
    Object.values(commandMap).forEach((command) => {
      getCommandNames(command).forEach((name) => names.add(name));
    });
    return Array.from(names).sort();
  };

  /**
   * 根据前缀匹配命令名称
   */
  const matchCommandNames = (prefix: string): string[] => {
    const lowerPrefix = prefix.toLowerCase();
    return getAllCommandNames().filter((name) =>
      name.toLowerCase().startsWith(lowerPrefix),
    );
  };

  /**
   * 获取命令对象
   */
  const getCommand = (name: string): CommandType | undefined => {
    return commandMap[name.toLowerCase()];
  };

  /**
   * 获取子命令名称列表
   */
  const getSubCommandNames = (command: CommandType): string[] => {
    if (!command.subCommands) {
      return [];
    }
    const names = new Set<string>();
    Object.values(command.subCommands).forEach((subCommand) => {
      getCommandNames(subCommand).forEach((name) => names.add(name));
    });
    return Array.from(names).sort();
  };

  /**
   * 获取命令选项列表（含 --key 和 -alias）
   */
  const getOptionNames = (command: CommandType): string[] => {
    const names: string[] = [];
    command.options?.forEach((option) => {
      names.push(`--${option.key}`);
      option.alias?.forEach((alias) => names.push(`-${alias}`));
    });
    return names;
  };

  /**
   * 根据前缀匹配子命令
   */
  const matchSubCommand = (
    command: CommandType,
    prefix: string,
  ): CommandType | undefined => {
    if (!command.subCommands) {
      return undefined;
    }
    const lowerPrefix = prefix.toLowerCase();
    // 优先精确匹配
    if (command.subCommands[lowerPrefix]) {
      return command.subCommands[lowerPrefix];
    }
    // 前缀匹配
    return Object.values(command.subCommands).find((subCommand) =>
      getCommandNames(subCommand).some((name) =>
        name.toLowerCase().startsWith(lowerPrefix),
      ),
    );
  };

  /**
   * 设置提示文本
   */
  const setHint = (inputText: string) => {
    // 未开启提示
    if (!showHint) {
      return;
    }
    if (!inputText) {
      hint.value = "";
      return;
    }
    const tokens = getTokens(inputText);
    const func = tokens[0]?.toLowerCase() ?? "";
    const command = getCommand(func);
    if (!command) {
      hint.value = "";
      return;
    }
    // 只有命令名，显示命令本身用法
    if (tokens.length === 1) {
      hint.value = getUsageStr(command);
      return;
    }
    // 子命令提示（支持前缀匹配）
    if (command.subCommands) {
      const subCommand = matchSubCommand(command, tokens[1]);
      hint.value = subCommand ? getUsageStr(subCommand, command) : "";
      return;
    }
    hint.value = getUsageStr(command);
  };

  /**
   * 选取下一个候选并推进循环索引
   */
  const pickNextCandidate = <T>(candidates: T[]): T => {
    const selected = candidates[tabCycleIndex % candidates.length];
    tabCycleIndex = (tabCycleIndex + 1) % candidates.length;
    return selected;
  };

  /**
   * 计算 Tab 补全结果
   * @param inputText 当前输入
   */
  const getTabCompletion = (
    inputText: string,
  ): { text: string; hint: string } | null => {
    const trimmed = trim(inputText);
    const endsWithSpace = /\s$/.test(inputText);

    // 空输入时补全第一个命令
    if (!trimmed) {
      const names = getAllCommandNames();
      if (names.length === 0) {
        return null;
      }
      const selected = pickNextCandidate(names);
      return { text: `${selected} `, hint: selected };
    }

    const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);
    const commandName = tokens[0]?.toLowerCase() ?? "";
    const command = getCommand(commandName);

    // 未匹配到命令：补全命令名
    if (!command) {
      const lastToken = tokens[tokens.length - 1].toLowerCase();
      const candidates = matchCommandNames(lastToken);
      if (candidates.length === 0) {
        return null;
      }
      const selected = pickNextCandidate(candidates);
      const rest = tokens.slice(0, tokens.length - 1).join(" ");
      return { text: rest ? `${rest} ${selected} ` : `${selected} `, hint: selected };
    }

    // 已匹配到命令：根据层级补全子命令或选项
    const subCommandName = tokens[1]?.toLowerCase() ?? "";
    const subCommand = command.subCommands?.[subCommandName];

    // 只有命令名，或命令名后以空格结尾：补全子命令
    if (tokens.length === 1 || (endsWithSpace && tokens.length === 1)) {
      const subNames = getSubCommandNames(command);
      if (subNames.length === 0) {
        return null;
      }
      const selected = pickNextCandidate(subNames);
      return { text: `${trimmed} ${selected} `, hint: selected };
    }

    // 正在输入第二个词：补全子命令；若无匹配则补全父命令选项
    if (tokens.length === 2 && !endsWithSpace) {
      const prefix = tokens[1].toLowerCase();
      const subCandidates = getSubCommandNames(command).filter((name) =>
        name.toLowerCase().startsWith(prefix),
      );
      if (subCandidates.length > 0) {
        const selected = pickNextCandidate(subCandidates);
        return { text: `${commandName} ${selected} `, hint: selected };
      }
      const optionCandidates = getOptionNames(command).filter((name) =>
        name.toLowerCase().startsWith(prefix),
      );
      if (optionCandidates.length > 0) {
        const selected = pickNextCandidate(optionCandidates);
        return { text: `${commandName} ${selected}`, hint: selected };
      }
      return null;
    }

    // 已输入子命令：补全该子命令的选项
    if (subCommand) {
      const lastToken = tokens[tokens.length - 1];
      const prefix = endsWithSpace ? "" : lastToken.toLowerCase();
      const optionNames = getOptionNames(subCommand);
      const candidates = optionNames.filter((name) =>
        prefix ? name.toLowerCase().startsWith(prefix) : true,
      );
      if (candidates.length === 0) {
        return null;
      }
      const selected = pickNextCandidate(candidates);
      if (endsWithSpace) {
        return { text: `${trimmed} ${selected}`, hint: selected };
      }
      const rest = tokens.slice(0, tokens.length - 1).join(" ");
      return { text: `${rest} ${selected}`, hint: selected };
    }

    // 未匹配到子命令：补全父命令选项
    const lastToken = tokens[tokens.length - 1];
    const prefix = endsWithSpace ? "" : lastToken.toLowerCase();
    const optionNames = getOptionNames(command);
    const candidates = optionNames.filter((name) =>
      prefix ? name.toLowerCase().startsWith(prefix) : true,
    );
    if (candidates.length === 0) {
      return null;
    }
    const selected = pickNextCandidate(candidates);
    if (endsWithSpace) {
      return { text: `${trimmed} ${selected}`, hint: selected };
    }
    const rest = tokens.slice(0, tokens.length - 1).join(" ");
    return { text: `${rest} ${selected}`, hint: selected };
  };

  /**
   * 重置 Tab 循环索引
   */
  const resetTabCycle = () => {
    tabCycleIndex = 0;
  };

  // 输入提示防抖
  const debounceSetHint = debounce(function (inputText: string) {
    setHint(inputText);
  }, 300);

  return {
    hint,
    setHint,
    debounceSetHint,
    getTabCompletion,
    resetTabCycle,
  };
};

export default useHint;

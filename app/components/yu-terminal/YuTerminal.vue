<template>
  <div
    class="yu-terminal-wrapper"
    :style="wrapperStyle"
    @click="handleClickWrapper"
  >
    <div ref="terminalRef" class="yu-terminal" :style="mainStyle">
      <!-- 状态栏：当前空间路径 + 实时时钟 (#100 #83) -->
      <div class="terminal-status-bar">
        <span class="terminal-status-path">{{ prompt }}</span>
        <span class="terminal-status-clock">{{ currentTime }}</span>
      </div>
      <a-collapse
        v-model:active-key="activeKeys"
        :bordered="false"
        expand-icon-position="right"
      >
        <template v-for="(output, index) in outputList" :key="index">
          <!-- 折叠 -->
          <a-collapse-panel
            v-if="output.collapsible"
            :key="index"
            class="terminal-row"
          >
            <template #header>
              <span style="user-select: none; margin-right: 10px">
                {{ prompt }}
              </span>
              <span>{{ output.text }}</span>
            </template>
            <div
              v-for="(result, idx) in output.resultList"
              :key="idx"
              class="terminal-row"
            >
              <content-output :output="result" />
            </div>
          </a-collapse-panel>
          <!-- 不折叠 -->
          <template v-else>
            <!-- 输出命令及结果-->
            <template v-if="output.type === 'command'">
              <div class="terminal-row">
                <span style="user-select: none; margin-right: 10px">{{
                  prompt
                }}</span>
                <span>{{ output.text }}</span>
              </div>
              <div
                v-for="(result, idx) in output?.resultList"
                :key="idx"
                class="terminal-row"
              >
                <content-output :output="result" />
              </div>
            </template>
            <!-- 打印信息 -->
            <template v-else>
              <div class="terminal-row">
                <content-output :output="output" />
              </div>
            </template>
          </template>
        </template>
      </a-collapse>
      <div class="terminal-row">
        <a-input
          ref="commandInputRef"
          v-model:value="inputCommand.text"
          :disabled="isRunning"
          class="command-input"
          :placeholder="inputCommand.placeholder"
          :bordered="false"
          autofocus
          @press-enter="doSubmitCommand"
        >
          <template #addonBefore>
            <span class="command-input-prompt">{{ prompt }}</span>
          </template>
        </a-input>
      </div>
      <!-- 反向搜索历史状态 (#29) -->
      <div
        v-if="isSearchMode"
        class="terminal-row"
        style="color: var(--terminal-prompt, #9f9)"
      >
        (reverse-i-search)'{{ inputCommand.text }}':
        {{ searchResults[searchCursor]?.text || "无匹配" }}
        <span style="opacity: 0.6">（Ctrl+R 切换 / Enter 接受 / Esc 退出）</span>
      </div>
      <!-- 输入提示-->
      <div v-if="hint && !isRunning" class="terminal-row" style="color: var(--terminal-foreground, #bbb); opacity: 0.7">
        提示：{{ hint }}
      </div>
      <!-- 命令面板 (Ctrl + K) -->
      <CommandPalette
        v-if="isPaletteOpen"
        :terminal="terminal"
        @close="isPaletteOpen = false"
      />
      <div style="margin-bottom: 16px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  markRaw,
  onMounted,
  onUnmounted,
  Ref,
  ref,
  StyleValue,
  toRefs,
  watch,
  watchEffect,
} from "vue";
import CommandOutputType = YuTerminal.CommandOutputType;
import OutputType = YuTerminal.OutputType;
import CommandInputType = YuTerminal.CommandInputType;
import { registerShortcuts } from "./shortcuts";
import TerminalType = YuTerminal.TerminalType;
import TextOutputType = YuTerminal.TextOutputType;
import useHistory from "./history";
import CommandPalette from "./CommandPalette.vue";
import ContentOutput from "./ContentOutput.vue";
import OutputStatusType = YuTerminal.OutputStatusType;
import { useTerminalConfigStore } from "../../core/commands/terminal/config/terminalConfigStore";
import { useThemeStore } from "../../core/commands/theme/themeStore";
import { useSpaceStore } from "../../core/commands/space/spaceStore";
import useHint from "./hint";
import UserType = User.UserType;
import { LOCAL_USER } from "../../core/commands/user/userConstant";
import { defineStore } from "pinia";

interface YuTerminalProps {
  height?: string | number;
  fullScreen?: boolean;
  user?: UserType;
  // eslint-disable-next-line vue/require-default-prop
  onSubmitCommand?: (inputText: string) => void;
}

const props = withDefaults(defineProps<YuTerminalProps>(), {
  height: "400px",
  fullScreen: false,
  user: LOCAL_USER as any,
});

const { user } = toRefs(props);

const terminalRef = ref();
const activeKeys = ref<number[]>([]);
// 输出列表
const outputList = ref<OutputType[]>([]);
// 命令列表
const commandList = ref<CommandOutputType[]>([]);
// 命令历史本地存储 key
const COMMAND_HISTORY_KEY = "yu-terminal-command-history";
// 输出快照 key（防误刷新，刷新后可恢复）(#94)
const OUTPUT_SNAPSHOT_KEY = "yu-terminal-output-snapshot";
// 最大保存历史条数
const MAX_HISTORY_SIZE = 100;

// 空间状态（用于提示符显示当前路径 #83）
const spaceStore = useSpaceStore();

/**
 * 实时时钟 (#100)
 */
const currentTime = ref(formatClock());
let clockTimer: ReturnType<typeof setInterval> | undefined;
function formatClock(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 提示符（含当前空间路径）(#83)
 */
const spacePrompt = computed(() => {
  const dir = spaceStore.currentDir || "/";
  return `[${user.value.username}@${dir}]$`;
});

// 保持 prompt 与 spacePrompt 一致（原 prompt 仅含用户名）
const prompt = computed(() => spacePrompt.value);

/**
 * 脱敏命令历史中的密码参数，避免明文凭据落入 localStorage
 * 覆盖 -p xxx / -p=xxx / --password xxx / --password=xxx / -password xxx
 */
function redactSensitiveText(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(
    /(--?password|-p)\b(=|\s+)(\S+)/gi,
    (_m, flag, sep) => `${flag}${sep}***`,
  );
}
const commandInputRef = ref();

// 命令是否运行
const isRunning = ref(false);

// 引入终端配置状态
const configStore = useTerminalConfigStore();
// 引入主题状态
const themeStore = useThemeStore();

/**
 * 初始命令
 */
const initCommand: CommandInputType = {
  text: "",
  placeholder: "",
};

/**
 * 待输入的命令
 */
const inputCommand = ref<CommandInputType>({
  ...initCommand,
});

/**
 * 全局记录当前命令，便于写入结果
 */
let currentNewCommand: CommandOutputType;

const {
  commandHistoryPos,
  showPrevCommand,
  showNextCommand,
  listCommandHistory,
} = useHistory(commandList, inputCommand);

// 持久化命令历史
watch(
  commandList,
  (newVal) => {
    try {
      localStorage.setItem(
        COMMAND_HISTORY_KEY,
        JSON.stringify(
          newVal.slice(-MAX_HISTORY_SIZE).map((c) => ({
            ...c,
            text: redactSensitiveText(c.text),
          })),
        ),
      );
    } catch (e) {
      console.error("保存命令历史失败", e);
    }
  },
  { deep: true },
);

const { hint, setHint, debounceSetHint, getTabCompletion, resetTabCycle } = useHint();

/**
 * 自动滚动到底部（仅当用户已在底部附近，避免打断向上查阅）(#93)
 */
const isNearBottom = (): boolean => {
  const el = terminalRef.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
};
const scrollToBottom = () => {
  const el = terminalRef.value;
  if (el) el.scrollTop = el.scrollHeight;
};
watch(
  outputList,
  () => {
    if (isNearBottom()) {
      setTimeout(scrollToBottom, 0);
    }
  },
  { deep: true },
);

/**
 * 快照序列化前清洗：组件（含内嵌 resultList 中的组件）无法 JSON 序列化，
 * 转为提示文本，避免恢复后出现残缺空白/报错 (#94)
 */
const sanitizeForSnapshot = (o: any): any => {
  if (!o || typeof o !== "object") {
    return null;
  }
  if (o.type === "component") {
    return { type: "text", text: "（该内容包含交互组件，刷新后已省略）" };
  }
  // 命令回显同样需要脱敏，避免 `user login -p xxx` 明文落入 localStorage
  if (o.type === "command" && typeof o.text === "string") {
    return { ...o, text: redactSensitiveText(o.text) };
  }
  if (Array.isArray(o.resultList)) {
    const resultList = o.resultList
      .map((r: any) => sanitizeForSnapshot(r))
      .filter(Boolean);
    return { ...o, resultList };
  }
  return o;
};

/**
 * 输出快照持久化（防误刷新，刷新后可恢复）(#94)
 */
const persistSnapshot = () => {
  try {
    const serializable = outputList.value
      .map((o) => sanitizeForSnapshot(o))
      .filter(Boolean);
    localStorage.setItem(
      OUTPUT_SNAPSHOT_KEY,
      JSON.stringify(serializable.slice(-200)),
    );
  } catch (e) {
    // 忽略序列化失败
  }
};
watch(outputList, persistSnapshot, { deep: true });

/**
 * 命令面板开关 (Ctrl + K)
 */
const isPaletteOpen = ref(false);
const openCommandPalette = () => {
  isPaletteOpen.value = true;
};

/**
 * 反向搜索历史命令（Ctrl + R）(#29)
 */
const isSearchMode = ref(false);
const searchResults = ref<CommandOutputType[]>([]);
const searchCursor = ref(0);

const computeSearchResults = () => {
  const q = inputCommand.value.text.trim().toLowerCase();
  const matched = q
    ? commandList.value.filter((c) => c.text.toLowerCase().includes(q))
    : [...commandList.value];
  searchResults.value = matched.reverse();
  searchCursor.value = 0;
};

const reverseSearch = () => {
  if (!isSearchMode.value) {
    isSearchMode.value = true;
    inputCommand.value.text = "";
    computeSearchResults();
  } else if (searchResults.value.length > 0) {
    // 循环到上一条匹配
    searchCursor.value =
      (searchCursor.value + 1) % searchResults.value.length;
  }
  focusInput();
};

const exitReverseSearch = () => {
  if (!isSearchMode.value) {
    return;
  }
  isSearchMode.value = false;
};

const acceptSearchResult = () => {
  const item = searchResults.value[searchCursor.value];
  if (item) {
    inputCommand.value.text = item.text;
  }
  exitReverseSearch();
  focusInput();
};

// 搜索模式下，输入即过滤历史
watch(inputCommand, () => {
  if (isSearchMode.value) {
    computeSearchResults();
  }
}, { deep: true });

/**
 * 提交命令（回车）
 */
const doSubmitCommand = async () => {
  // 反向搜索模式下，回车表示接受当前匹配并退出搜索，不直接执行
  if (isSearchMode.value) {
    acceptSearchResult();
    return;
  }
  isRunning.value = true;
  setHint("");
  try {
    let inputText = inputCommand.value.text;
    // 执行某条历史命令
    if (inputText.startsWith("!")) {
      const commandIndex = Number(inputText.substring(1));
      if (
        isNaN(commandIndex) ||
        commandIndex < 1 ||
        commandIndex > commandList.value.length
      ) {
        terminal.writeTextErrorResult("无效的历史命令序号");
        inputCommand.value = { ...initCommand };
        return;
      }
      const command = commandList.value[commandIndex - 1];
      if (command) {
        inputText = command.text;
      }
    }
    // 执行命令
    const newCommand: CommandOutputType = {
      text: inputText,
      type: "command",
      resultList: [],
    };
    // 记录当前命令，便于写入结果
    currentNewCommand = newCommand;
    // 执行命令
    await props.onSubmitCommand?.(inputText);
    // 添加输出（为空也要输出换行）
    outputList.value.push(newCommand);
    // 不为空字符串才算是有效命令
    if (inputText) {
      commandList.value.push(newCommand);
      // 重置当前要查看的命令位置
      commandHistoryPos.value = commandList.value.length;
    }
    inputCommand.value = { ...initCommand };
    // 默认展开折叠面板
    activeKeys.value.push(outputList.value.length - 1);
    // 自动滚到底部
    setTimeout(() => {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
    }, 50);
  } finally {
    // 无论命令是否抛错，都复位输入框，避免永久禁用
    isRunning.value = false;
  }
};

// 输入框内容改变时，触发输入提示并重置 Tab 循环索引
watchEffect(() => {
  resetTabCycle();
  debounceSetHint(inputCommand.value.text);
});

/**
 * 输入提示符（定义见上方 spacePrompt / prompt）
 */

/**
 * 终端主样式
 */
const mainStyle = computed(() => {
  const fullScreenStyle: StyleValue = {
    position: "fixed",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  return props.fullScreen
    ? fullScreenStyle
    : {
        height: props.height,
      };
});

/**
 * 终端包装类主样式
 */
const wrapperStyle = computed(() => {
  const { background } = configStore;
  const style: StyleValue = {
    ...mainStyle.value,
  };
  // 优先使用自定义背景，否则使用主题背景
  if (background) {
    if (background.startsWith("http")) {
      style.background = `url(${background})`;
    } else {
      style.background = background;
    }
  } else {
    style.background = themeStore.currentTheme.background;
  }
  // 注入主题 CSS 变量
  style["--terminal-background" as any] = themeStore.currentTheme.background;
  style["--terminal-foreground" as any] = themeStore.currentTheme.foreground;
  style["--terminal-prompt" as any] = themeStore.currentTheme.prompt;
  style["--terminal-success" as any] = themeStore.currentTheme.success;
  style["--terminal-error" as any] = themeStore.currentTheme.error;
  style["--terminal-warning" as any] = themeStore.currentTheme.warning;
  style["--terminal-link" as any] = themeStore.currentTheme.link;
  return style;
});

/**
 * 清空所有输出
 */
const clear = () => {
  outputList.value = [];
};

/**
 * 写命令文本结果
 * @param text
 * @param status
 */
const writeTextResult = (text: string, status?: OutputStatusType) => {
  const newOutput: TextOutputType = {
    text,
    type: "text",
    status,
  };
  currentNewCommand.resultList.push(newOutput);
};

/**
 * 写文本错误状态结果
 * @param text
 */
const writeTextErrorResult = (text: string) => {
  writeTextResult(text, "error");
};

/**
 * 写文本成功状态结果
 * @param text
 */
const writeTextSuccessResult = (text: string) => {
  writeTextResult(text, "success");
};

/**
 * 写结果
 * @param output
 */
const writeResult = (output: OutputType) => {
  // 避免 Vue 对组件对象做响应式包装，减少性能开销并消除警告
  if (output.type === "component" && (output as any).component) {
    (output as any).component = markRaw((output as any).component);
  }
  currentNewCommand.resultList.push(output);
};

/**
 * 立即输出文本
 * @param text
 * @param status
 */
const writeTextOutput = (text: string, status?: OutputStatusType) => {
  const newOutput: TextOutputType = {
    text,
    type: "text",
    status,
  };
  outputList.value.push(newOutput);
};

/**
 * 设置命令是否可折叠
 * @param collapsible
 */
const setCommandCollapsible = (collapsible: boolean) => {
  currentNewCommand.collapsible = collapsible;
};

/**
 * 立即输出
 * @param newOutput
 */
const writeOutput = (newOutput: OutputType) => {
  outputList.value.push(newOutput);
};

/**
 * 输入框聚焦
 */
const focusInput = () => {
  commandInputRef.value.focus();
};
/**
 * 获取输入框是否聚焦
 */
const isInputFocused = () => {
  const wrapperEl = commandInputRef.value?.$el as HTMLElement | undefined;
  if (!wrapperEl) {
    return false;
  }
  return wrapperEl.contains(document.activeElement);
};
/**
 * 设置输入框的值
 */
const setTabCompletion = () => {
  const result = getTabCompletion(inputCommand.value.text);
  if (result) {
    inputCommand.value.text = result.text;
    setHint(result.text);
  }
};

/**
 * 折叠 / 展开所有块
 */
const toggleAllCollapse = () => {
  // 展开
  if (activeKeys.value.length === 0) {
    activeKeys.value = outputList.value.map((_, index) => {
      return index;
    });
  } else {
    // 折叠
    activeKeys.value = [];
  }
};

/**
 * 操作终端的对象
 */
const terminal: TerminalType = {
  writeTextResult,
  writeTextErrorResult,
  writeTextSuccessResult,
  writeResult,
  writeTextOutput,
  writeOutput,
  clear,
  focusInput,
  isInputFocused,
  setTabCompletion,
  doSubmitCommand,
  showNextCommand,
  showPrevCommand,
  listCommandHistory,
  toggleAllCollapse,
  setCommandCollapsible,
  reverseSearch,
  exitReverseSearch,
  openCommandPalette,
};

let unregisterShortcuts: (() => void) | undefined;

/**
 * 只执行一次
 */
onMounted(() => {
  // 启动实时时钟 (#100)
  clockTimer = setInterval(() => {
    currentTime.value = formatClock();
  }, 1000);
  // 刷新前提醒已移除：输出快照可自动恢复，无需每次刷新弹确认框 (#94)
  unregisterShortcuts = registerShortcuts(terminal);
  // 恢复命令历史
  try {
    const savedHistory = localStorage.getItem(COMMAND_HISTORY_KEY);
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      if (Array.isArray(parsed)) {
        commandList.value = parsed;
        commandHistoryPos.value = parsed.length;
      }
    }
  } catch (e) {
    console.error("恢复命令历史失败", e);
  }
  // 恢复输出快照 (#94)
  let restored = false;
  try {
    const saved = localStorage.getItem(OUTPUT_SNAPSHOT_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) {
        // 清洗，兼容旧版本残留的残缺组件结果
        outputList.value = arr
          .map((o: any) => sanitizeForSnapshot(o))
          .filter(Boolean);
        restored = true;
      }
    }
  } catch (e) {
    console.error("恢复输出快照失败", e);
  }
  const { welcomeTexts } = configStore;
  if (!restored) {
    if (welcomeTexts?.length > 0) {
      welcomeTexts.forEach((welcomeText) => {
        terminal.writeTextOutput(welcomeText);
      });
    } else {
      terminal.writeTextOutput(
        `欢迎来到 webCommand，最极客范儿的浏览器主页！请输入 'help' 开始体验`,
      );
      terminal.writeTextOutput("");
    }
  }
  // 恢复后立即滚到底部
  setTimeout(scrollToBottom, 50);
});

onUnmounted(() => {
  unregisterShortcuts?.();
  if (clockTimer) {
    clearInterval(clockTimer);
  }
});

/**
 * 当点击空白聚焦输入框
 */
function handleClickWrapper(event: Event): void {
  const target = event.target as Element | null;
  if (target && target.classList && target.classList.contains("yu-terminal")) {
    focusInput();
  }
}

defineExpose({
  terminal,
});
</script>

<style scoped>
.yu-terminal-wrapper {
  background: var(--terminal-background, black);
  color: var(--terminal-foreground, white);
}

.yu-terminal {
  background: rgba(0, 0, 0, 0.6);
  background: color-mix(in srgb, var(--terminal-background, black) 60%, transparent);
  padding: 20px;
  overflow: scroll;
  color: var(--terminal-foreground, white);
}

.yu-terminal::-webkit-scrollbar {
  display: none;
}

.yu-terminal span {
  font-size: 16px;
}

.yu-terminal
  :deep(
    .ant-collapse-icon-position-right
      > .ant-collapse-item
      > .ant-collapse-header
  ) {
  color: var(--terminal-foreground, white);
  padding: 0;
}

.yu-terminal :deep(.ant-collapse) {
  background: none;
}

.yu-terminal :deep(.ant-collapse-borderless > .ant-collapse-item) {
  border: none;
}

.yu-terminal :deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 0;
}

.command-input {
  caret-color: var(--terminal-foreground, white);
}

.command-input :deep(input) {
  color: var(--terminal-foreground, white) !important;
  font-size: 16px;
  padding: 0 10px;
}

.command-input :deep(.ant-input-group-addon) {
  background: none;
  border: none;
  padding: 0;
}

.command-input-prompt {
  color: var(--terminal-prompt, white);
  background: transparent;
}

.terminal-row {
  color: var(--terminal-foreground, white);
  font-size: 16px;
  font-family: courier-new, courier, monospace;
}

.terminal-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--terminal-prompt, #9f9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  user-select: none;
}

.terminal-status-clock {
  font-family: courier-new, courier, monospace;
}
</style>

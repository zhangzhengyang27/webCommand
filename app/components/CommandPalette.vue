<template>
  <div class="palette-mask" @click.self="emit('close')">
    <div class="palette">
      <input
        ref="inputRef"
        v-model="query"
        class="palette-input"
        placeholder="输入命令名或关键词，Enter 执行，Esc 关闭"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="execute(filteredItems[activeIndex])"
        @keydown.esc.prevent="emit('close')"
      />
      <div class="palette-list">
        <div
          v-for="(item, index) in filteredItems"
          :key="item.key"
          class="palette-item"
          :class="{ active: index === activeIndex }"
          @mouseenter="activeIndex = index"
          @click="execute(item)"
        >
          <span class="palette-func">{{ item.label }}</span>
          <span class="palette-name">{{ item.desc }}</span>
        </div>
        <div v-if="!filteredItems.length" class="palette-empty">无匹配命令</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { commandList } from '../core/commandRegister'
import { useCustomCommandStore } from '../core/commands/custom/customStore'
import { doCommandExecute } from '../core/commandExecutor'
import TerminalType = Terminal.TerminalType

const props = defineProps<{ terminal: TerminalType }>()
const emit = defineEmits<{ (e: 'close'): void }>()

interface PaletteItem {
  key: string
  label: string // 回车后执行的文本
  desc: string
  search: string // 参与匹配的文本（小写）
}

// 内置命令（每个命令只列主名，别名仍可搜索）
const builtinItems: PaletteItem[] = commandList.map((cmd) => ({
  key: `cmd:${cmd.func}`,
  label: cmd.func,
  desc: cmd.desc || cmd.name || '',
  search: `${cmd.func} ${cmd.name ?? ''} ${(cmd.alias ?? []).join(' ')}`.toLowerCase(),
}))

// 自定义命令（登录与持久化由 store 负责）
const customItems: PaletteItem[] = useCustomCommandStore()
  .listCustom()
  .map(([name, text]) => ({
    key: `custom:${name}`,
    label: name,
    desc: `自定义 => ${text}`,
    search: `custom ${name} ${text}`.toLowerCase(),
  }))

const allItems: PaletteItem[] = [...builtinItems, ...customItems]

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement>()

const filteredItems = computed<PaletteItem[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return allItems
  }
  // 空格分隔多关键词，全部命中才算匹配
  const terms = q.split(/\s+/)
  return allItems.filter((item) => terms.every((t) => item.search.includes(t)))
})

watch(query, () => {
  activeIndex.value = 0
})

const moveActive = (delta: number) => {
  const len = filteredItems.value.length
  if (!len) {
    return
  }
  activeIndex.value = (activeIndex.value + delta + len) % len
}

const execute = (item?: PaletteItem) => {
  if (!item) {
    return
  }
  emit('close')
  doCommandExecute(item.label, props.terminal)
  props.terminal.focusInput()
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})
</script>

<style scoped>
.palette-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}

.palette {
  width: min(560px, 90vw);
  background: #25272e;
  color: #e8e8e8;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.palette-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  font-size: 15px;
  font-family: monospace;
  background: transparent;
  border: none;
  outline: none;
  color: inherit;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.palette-list {
  max-height: 46vh;
  overflow-y: auto;
  padding: 6px;
}

.palette-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.palette-item.active {
  background: rgba(255, 255, 255, 0.12);
}

.palette-func {
  font-family: monospace;
  font-weight: bold;
  min-width: 90px;
}

.palette-name {
  font-size: 13px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-empty {
  padding: 20px;
  text-align: center;
  opacity: 0.6;
}
</style>

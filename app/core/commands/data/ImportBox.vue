<template>
  <div class="import-box">
    <div class="tip">
      粘贴备份 JSON（export 命令导出的文件内容），导入将<b>覆盖</b>当前待办 / 空间 / 自定义命令 /
      速记数据。
    </div>
    <textarea v-model="text" class="textarea" placeholder='{"app":"webCommand","version":1,...}' />
    <div class="actions">
      <button class="btn" :disabled="importing || !text.trim()" @click="doImport">导入</button>
      <span v-if="message" :class="ok ? 'msg-ok' : 'msg-err'">{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore } from '../todo/todoStore'
import { useSpaceStore } from '../space/spaceStore'
import { useCustomCommandStore } from '../custom/customStore'
import { useNoteStore } from '../note/noteStore'

const text = ref('')
const importing = ref(false)
const message = ref('')
const ok = ref(false)

const doImport = () => {
  message.value = ''
  let backup: any
  try {
    backup = JSON.parse(text.value)
  } catch {
    message.value = 'JSON 解析失败'
    ok.value = false
    return
  }
  // 兼容整体备份对象与直接传 data 对象两种形式
  const data = backup?.app === 'webCommand' ? backup.data : backup
  if (!data || typeof data !== 'object') {
    message.value = '备份格式不正确'
    ok.value = false
    return
  }
  importing.value = true
  try {
    const counts: string[] = []
    if (Array.isArray(data.todo)) {
      useTodoStore().importBackup(data.todo)
      counts.push(`待办 ${data.todo.length} 条`)
    }
    if (data.space && typeof data.space === 'object') {
      useSpaceStore().importBackup(data.space)
      counts.push('空间')
    }
    if (data.custom && typeof data.custom === 'object') {
      useCustomCommandStore().importBackup(data.custom)
      counts.push(`自定义命令 ${Object.keys(data.custom).length} 个`)
    }
    if (Array.isArray(data.note)) {
      useNoteStore().importBackup(data.note)
      counts.push(`速记 ${data.note.length} 条`)
    }
    if (!counts.length) {
      message.value = '备份中没有可导入的数据'
      ok.value = false
    } else {
      message.value = `导入成功：${counts.join('、')}`
      ok.value = true
    }
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.import-box {
  margin: 8px 0;
  max-width: 640px;
}

.tip {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.textarea {
  width: 100%;
  height: 140px;
  box-sizing: border-box;
  font-family: monospace;
  font-size: 12px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: rgba(128, 128, 128, 0.06);
  color: inherit;
  resize: vertical;
}

.actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn {
  padding: 4px 16px;
  border-radius: 6px;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: rgba(128, 128, 128, 0.1);
  color: inherit;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.msg-ok {
  color: #52c41a;
  font-size: 13px;
}

.msg-err {
  color: #ff4d4f;
  font-size: 13px;
}
</style>

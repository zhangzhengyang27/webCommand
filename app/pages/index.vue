<template>
  <terminal ref="terminalRef" :user="loginUser" full-screen :on-submit-command="onSubmitCommand" />
</template>

<script setup lang="ts">
import { doCommandExecute } from '../core/commandExecutor'
import { onMounted, ref } from 'vue'
import { useUserStore } from '../core/commands/user/userStore'
import { storeToRefs } from 'pinia'
import { initAllCloudSync } from '../composables/cloudSyncRegistry'

const terminalRef = ref()

const onSubmitCommand = async (inputText: string) => {
  if (!inputText) {
    return
  }
  const terminal = terminalRef.value.terminal
  await doCommandExecute(inputText, terminal)
}

const userStore = useUserStore()
const { loginUser } = storeToRefs(userStore)

onMounted(async () => {
  await userStore.getAndSetLoginUser()
  // remember 自动登录路径同样要初始化云同步：漏掉的类型既不会从云端拉取，
  // 该端下一次改动还会把云端已有数据整包覆盖掉（#24 #25）
  if (userStore.loginUser?.id) {
    await initAllCloudSync()
  }
})
</script>

<style></style>

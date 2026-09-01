<template>
  <yu-terminal
    ref="terminalRef"
    :user="loginUser"
    full-screen
    :on-submit-command="onSubmitCommand"
  />
</template>

<script setup lang="ts">
import { doCommandExecute } from '../core/commandExecutor'
import { onMounted, ref } from 'vue'
import { useUserStore } from '../core/commands/user/userStore'
import { useTodoStore } from '../core/commands/todo/todoStore'
import { useSpaceStore } from '../core/commands/space/spaceStore'
import { storeToRefs } from 'pinia'

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
  // 登录态恢复后，初始化 todo / space 云端同步 (#24 #25)
  if (userStore.loginUser?.id) {
    useTodoStore().initCloudSync()
    useSpaceStore().initCloudSync()
  }
})
</script>

<style></style>

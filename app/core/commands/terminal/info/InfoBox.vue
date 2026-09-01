<template>
  <div>关于本站：webCommand 极客范儿的浏览器主页</div>
</template>

<script setup lang="ts">
interface InfoBoxProps {
  seconds?: string;
}

withDefaults(defineProps<InfoBoxProps>(), {
  seconds: "",
});
</script>

<style scoped></style>

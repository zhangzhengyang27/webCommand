<template>
  <div class="content-output">
    <template v-if="output.type === 'text'">
      <div class="content-output-row">
        <a-tag v-if="outputTagColor" :color="outputTagColor">{{
          output.status
        }}</a-tag>
        <span v-html="smartText(output.text)" />
        <a-button
          class="copy-btn"
          size="small"
          type="text"
          @click="copyText"
          >{{ copied ? "已复制" : "复制" }}</a-button
        >
      </div>
    </template>
    <component
      :is="output.component"
      v-if="output.type === 'component' && output.component"
      v-bind="output.props ?? {}"
    />
  </div>
</template>

<script setup lang="ts">
import smartText from "../../utils/smartText";
import OutputType = YuTerminal.OutputType;
import { computed, ref, toRefs } from "vue";

interface OutputProps {
  output: OutputType;
}

const props = defineProps<OutputProps>();
const { output } = toRefs(props);

/**
 * 复制输出文本到剪贴板 (#30)
 */
const copied = ref(false);
const copyText = async () => {
  try {
    await navigator.clipboard.writeText(output.value.text || "");
    copied.value = true;
    setTimeout(() => (copied.value = false), 1200);
  } catch (e) {
    console.error("复制失败", e);
  }
};
const outputTagColor = computed((): string => {
  if (!output.value.status) {
    return "";
  }
  switch (output.value.status) {
    case "info":
      return "dodgerblue";
    case "success":
      return "limegreen";
    case "warning":
      return "darkorange";
    case "error":
      return "#c0300f";
    case "system":
      return "#bfc4c9";
    default:
      return "";
  }
});
</script>

<style scoped>
.content-output :deep(.ant-tag) {
  border-radius: 0;
  font-size: 16px;
  border: none;
}

.content-output-row {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.copy-btn {
  opacity: 0;
  margin-left: 8px;
  font-size: 12px;
  vertical-align: middle;
  transition: opacity 0.2s;
}

.content-output-row:hover .copy-btn {
  opacity: 0.8;
}
</style>

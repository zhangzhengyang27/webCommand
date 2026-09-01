<template>
  <div class="color-box">
    <div class="swatch" :style="{ backgroundColor: hex }" />
    <div class="values">
      <div class="value-item">HEX：{{ hex }}</div>
      <div class="value-item">
        RGB：{{ rgb }}<template v-if="alpha < 1">，Alpha：{{ alpha }}</template>
      </div>
      <div class="value-item">HSL：{{ hsl }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hex: string
  rgb: string
  alpha: number
  hsl: string
}>()
</script>

<style scoped>
.color-box {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 8px 0;
}

.swatch {
  width: 96px;
  height: 64px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 12px 12px;
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0px;
}

.values {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.8;
}
</style>

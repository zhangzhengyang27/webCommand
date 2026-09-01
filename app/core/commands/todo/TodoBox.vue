<template>
  <div style="margin: 8px 0; max-width: 600px">
    <a-card :body-style="{ padding: '0 12px' }">
      <a-row style="padding: 12px 0">
        <a-col :span="8" style="text-align: center">
          <div style="font-size: 20px; font-weight: bold">{{ stats.total }}</div>
          <div style="font-size: 12px; opacity: 0.8">总计</div>
        </a-col>
        <a-col :span="8" style="text-align: center">
          <div style="font-size: 20px; font-weight: bold; color: var(--terminal-success, limegreen)">
            {{ stats.done }}
          </div>
          <div style="font-size: 12px; opacity: 0.8">已完成</div>
        </a-col>
        <a-col :span="8" style="text-align: center">
          <div style="font-size: 20px; font-weight: bold; color: var(--terminal-warning, darkorange)">
            {{ stats.todo }}
          </div>
          <div style="font-size: 12px; opacity: 0.8">待办</div>
        </a-col>
      </a-row>
      <a-divider style="margin: 0" />
      <a-list item-layout="horizontal" :data-source="taskList">
        <template #renderItem="{ item, index }">
          <a-list-item :key="item.id">
            <template #actions>
              <a-button type="text" danger @click="doDelete(item)">
                删除
              </a-button>
            </template>
            <a-list-item-meta>
              <template #title>
                <span :style="{ textDecoration: item.isFinished ? 'line-through' : 'none', opacity: item.isFinished ? 0.6 : 1 }">
                  {{ item.name }}
                </span>
              </template>
              <template #description>
                <div>编号：{{ item.id }}</div>
                <div>
                  创建：{{ MyDayjs(item.createTime).format("YYYY-MM-DD HH:mm") }}
                  <span v-if="item.finishTime">
                    | 完成：{{ MyDayjs(item.finishTime).format("YYYY-MM-DD HH:mm") }}
                  </span>
                </div>
              </template>
              <template #avatar>
                <a-checkbox
                  :checked="item.isFinished"
                  @change="
                    (e: CheckboxChangeEvent) =>
                      doToggle(index, e.target.checked)
                  "
                />
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTodoStore } from "./todoStore";
import MyDayjs from "../../../utils/myDayjs";
import TaskType = Todo.TaskType;

interface TodoBoxProps {
  today?: boolean;
}

withDefaults(defineProps<TodoBoxProps>(), {
  today: false,
});

const taskStore = useTodoStore();

const taskList = computed(() => {
  return taskStore.taskList;
});

const stats = computed(() => {
  return taskStore.stats;
});

const doDelete = (item: TaskType) => {
  taskStore.deleteTaskById(item.id);
};

type CheckboxChangeEvent = { target: { checked: boolean } };

const doToggle = (index: number, checked: boolean) => {
  taskStore.updateTask(index, { isFinished: checked } as TaskType);
};
</script>

<style scoped></style>

import { defineStore } from "pinia";

/**
 * 用户自定义命令（快捷方式）(#73)
 * 存储 name -> 要执行的命令文本，持久化到 localStorage
 */
export const useCustomCommandStore = defineStore("customCommand", {
  state: () => ({
    customMap: {} as Record<string, string>,
  }),
  getters: {
    getCustom: (state) => (name: string) =>
      state.customMap[name.toLowerCase()],
  },
  actions: {
    listCustom(): [string, string][] {
      return Object.entries(this.customMap);
    },
    addCustom(name: string, text: string) {
      this.customMap[name.toLowerCase()] = text;
    },
    removeCustom(name: string) {
      delete this.customMap[name.toLowerCase()];
    },
    /**
     * 从备份导入（覆盖当前数据）
     */
    importBackup(map: Record<string, string>) {
      if (map && typeof map === "object") {
        this.customMap = { ...map };
      }
    },
  },
  persist: {
    key: "custom-command-store",
    storage: window.localStorage,
  },
});

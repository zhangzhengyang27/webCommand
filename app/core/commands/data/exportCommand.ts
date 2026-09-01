import { CommandType } from "../../command";
import { useTodoStore } from "../todo/todoStore";
import { useSpaceStore } from "../space/spaceStore";
import { useCustomCommandStore } from "../custom/customStore";
import { useNoteStore } from "../note/noteStore";

/**
 * 数据导出命令：把本地/云端数据打包为 JSON 备份文件下载
 */
const exportCommand: CommandType = {
  func: "export",
  name: "数据导出",
  alias: ["backup"],
  desc: "导出待办/空间/自定义命令/速记为 JSON 备份文件",
  options: [],
  action(options, terminal) {
    const todo = useTodoStore();
    const space = useSpaceStore();
    const custom = useCustomCommandStore();
    const note = useNoteStore();
    const backup = {
      app: "webCommand",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        todo: todo.taskList,
        space: {
          space: space.space,
          currentDir: space.currentDir,
        },
        custom: custom.customMap,
        note: note.noteList,
      },
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    a.href = url;
    a.download = `webcommand-backup-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    terminal.writeTextSuccessResult(
      `已导出：待办 ${todo.taskList.length} 条、空间 ${Object.keys(space.space ?? {}).length} 个目录、自定义命令 ${Object.keys(custom.customMap).length} 个、速记 ${note.noteList.length} 条`,
    );
  },
};

export default exportCommand;

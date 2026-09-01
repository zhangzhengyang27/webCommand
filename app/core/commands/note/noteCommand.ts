import { CommandType } from "../../command";
import listCommand from "./subCommands/listCommand";
import addCommand from "./subCommands/addCommand";
import removeCommand from "./subCommands/removeCommand";
import clearCommand from "./subCommands/clearCommand";

/**
 * 速记命令（无子命令时默认列出）
 */
const noteCommand: CommandType = {
  func: "note",
  name: "速记",
  alias: ["memo", "笔记"],
  desc: "随手速记，登录后自动云同步",
  params: [
    {
      key: "subCommand",
      desc: "子命令：add / list / rm / clear",
    },
  ],
  subCommands: {
    add: addCommand,
    list: listCommand,
    rm: removeCommand,
    clear: clearCommand,
  },
  options: [],
  action(options, terminal) {
    listCommand.action(options, terminal);
  },
};

export default noteCommand;

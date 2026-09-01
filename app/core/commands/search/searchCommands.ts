import { CommandType } from "../../command";
import baiduCommand from "./baiduCommand";
import googleCommand from "./googleCommand";

/**
 * 搜索源
 */
const fromDict: Record<string, CommandType> = {
  baidu: baiduCommand,
  google: googleCommand,
};

/**
 * 搜索命令
 * @author yupi
 */
const searchCommand: CommandType = {
  func: "search",
  name: "网页搜索",
  alias: ["s", "sousuo", "sou", "query"],
  desc: "支持从百度、谷歌快捷搜索内容",
  params: [
    {
      key: "word",
      desc: "搜索内容",
      required: true,
    },
  ],
  options: [
    {
      // 来源
      key: "from",
      alias: ["f"],
      type: "string",
      defaultValue: "baidu",
    },
    {
      key: "self",
      desc: "是否当前页面打开",
      alias: ["c"],
      type: "boolean",
      defaultValue: false,
    },
  ],
  // 默认使用百度搜索
  action: (options, terminal) => {
    const { from = "baidu" } = options;
    // 执行不同搜索源的搜索方法
    const fromObj = fromDict[from];
    if (!fromObj) {
      terminal.writeTextErrorResult("找不到搜索源");
      return;
    }
    return fromObj.action(options, terminal);
  },
};

export default [searchCommand, ...Object.values(fromDict)];

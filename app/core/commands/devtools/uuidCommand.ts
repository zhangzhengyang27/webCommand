import { CommandType } from "../../command";

/**
 * UUID / 短随机 ID 生成命令
 */
const uuidCommand: CommandType = {
  func: "uuid",
  name: "UUID 生成",
  desc: "生成 UUID 或 8 位短随机 ID",
  params: [
    {
      key: "count",
      desc: "生成数量（默认 1，最大 50）",
    },
  ],
  options: [
    {
      key: "short",
      desc: "生成 8 位短 ID",
      alias: ["s"],
      type: "boolean",
    },
  ],
  action(options, terminal) {
    const { _, short } = options;
    const count = Math.min(Math.max(Number(_[0]) || 1, 1), 50);
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      if (short) {
        const arr = new Uint8Array(4);
        crypto.getRandomValues(arr);
        results.push(
          Array.from(arr)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
        );
      } else {
        results.push(crypto.randomUUID());
      }
    }
    terminal.writeTextSuccessResult(results.join("\n"));
  },
};

export default uuidCommand;

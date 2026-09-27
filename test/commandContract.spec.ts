import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const COMMANDS_DIR = join(ROOT, 'app/core/commands')

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...tsFiles(full))
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

const allFiles = tsFiles(COMMANDS_DIR)
const read = (file: string) => readFileSync(file, 'utf8')
const rel = (file: string) => relative(ROOT, file)

/** 声明了 CommandType 的命令模块（排除聚合文件与工具/类型文件） */
const commandFiles = allFiles.filter((f) => /:\s*CommandType\s*=/g.test(read(f)))

/**
 * 取出一个文件里的「命令名 + 命令别名」。
 * 只看每个 func: 之后、进入 options/params/subCommands/action 之前的那段——
 * 否则会把选项的短标记（如 alias: ['s'] 表示 -s）误当成命令别名，那不是冲突。
 */
function keysOf(file: string): string[] {
  const text = read(file)
  const keys: string[] = []
  for (const m of text.matchAll(/\bfunc:\s*'([^']+)'/g)) {
    keys.push(m[1]!.toLowerCase())
    const rest = text.slice(m.index)
    const window = rest.slice(0, rest.search(/\b(options|params|subCommands|action):/))
    for (const a of window.matchAll(/\balias:\s*\[([^\]]*)\]/g)) {
      for (const name of a[1]!.matchAll(/'([^']+)'/g)) keys.push(name[1]!.toLowerCase())
    }
  }
  return keys
}

const registerText = read(join(ROOT, 'app/core/commandRegister.ts'))

/**
 * 该文件是否被 parentFile 以 import 路径引用。
 * 按「相对 commands 目录的完整尾部路径」匹配，避免不同目录下的同名文件互相误判。
 */
function importedFrom(parentFile: string, file: string): boolean {
  const tail = relative(COMMANDS_DIR, file).replace(/\\/g, '/').replace(/\.ts$/, '')
  const escaped = tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`from\\s+'[^']*${escaped}'`).test(read(parentFile))
}

/** commandRegister 直接引用的模块（含聚合数组文件） */
const registeredDirect = allFiles.filter((f) =>
  importedFrom(join(ROOT, 'app/core/commandRegister.ts'), f),
)

/** 被展开进 commandList 的聚合数组文件，其成员同样是顶层命令 */
const aggregatorFiles = registeredDirect.filter((f) =>
  registerText.includes(`...${basename(f, '.ts')}`),
)

/** 等价于「顶层命令」作用域的全部模块 */
const topLevelFiles = [
  ...new Set([
    ...registeredDirect,
    ...aggregatorFiles.flatMap((agg) => allFiles.filter((f) => importedFrom(agg, f))),
  ]),
]

describe('命令注册表契约', () => {
  test('样本量足够（扫描规则失效时不能让测试静默全绿）', () => {
    assert.ok(commandFiles.length >= 40, `只识别到 ${commandFiles.length} 个命令模块`)
    assert.ok(topLevelFiles.length >= 30, `只识别到 ${topLevelFiles.length} 个顶层命令`)
  })

  test('每个命令模块都被引用（写了命令忘了登记会静默失效）', () => {
    const allSources = tsFiles(join(ROOT, 'app')).map(read)
    const orphans = commandFiles.filter((file) => {
      const name = basename(file, '.ts')
      return !allSources.some((text) => new RegExp(`from\\s+'[^']*${name}'`).test(text))
    })
    assert.deepEqual(orphans.map(rel), [])
  })

  test('顶层命令的命令名与别名互不冲突', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const file of topLevelFiles) {
      for (const key of keysOf(file)) {
        const owner = seen.get(key)
        if (owner && owner !== rel(file)) clashes.push(`${key}：${owner} 与 ${rel(file)}`)
        seen.set(key, rel(file))
      }
    }
    assert.deepEqual(clashes, [])
  })

  test('同一父命令目录内的子命令名互不冲突', () => {
    const byDir = new Map<string, string[]>()
    for (const file of commandFiles) {
      const dir = rel(file).split('/').slice(0, -1).join('/')
      byDir.set(dir, [...(byDir.get(dir) ?? []), ...keysOf(file)])
    }
    const clashes: string[] = []
    for (const [dir, keys] of byDir) {
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
      for (const dup of new Set(dupes)) clashes.push(`${dir}/${dup}`)
    }
    assert.deepEqual(clashes, [])
  })

  test('父命令 subCommands 的 key 必须与被引命令自己的 func 一致', () => {
    // 执行器是按 subCommands 的 key 查表的，key 与 func 不一致时命令能注册却对不上号，
    // 新增子命令（如 user delete）最容易在这里写错
    const mismatches: string[] = []
    for (const file of allFiles) {
      const text = read(file)
      const block = text.match(/subCommands:\s*\{([\s\S]*?)\n\s*\},/)
      if (!block) continue
      for (const pair of block[1]!.matchAll(/(\w+):\s*(\w+),/g)) {
        const [, key, identifier] = pair
        const target = allFiles.find((f) =>
          new RegExp(`const ${identifier!}\\s*:?\\s*(=|CommandType)`).test(read(f)),
        )
        if (!target) {
          mismatches.push(`${rel(file)}: 找不到 ${identifier} 的定义文件`)
          continue
        }
        const declared = read(target).match(/\bfunc:\s*'([^']+)'/)?.[1]
        if (declared !== key) {
          mismatches.push(
            `${rel(file)}: key="${key}" 但 ${basename(target)} 的 func 是 "${declared}"`,
          )
        }
      }
    }
    assert.deepEqual(mismatches, [])
  })

  test('每个命令模块都有 name，且要么能执行要么有子命令', () => {
    const bad = commandFiles.filter((file) => {
      const text = read(file)
      return (
        !/\bname:\s*'/.test(text) || (!/\bsubCommands\b/.test(text) && !/\baction\b/.test(text))
      )
    })
    assert.deepEqual(bad.map(rel), [])
  })
})

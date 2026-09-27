import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(dir))) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|vue)$/.test(name)) out.push(full)
  }
  return out
}

/** 从源码里解析出某个 `as const` 数组的字符串成员 */
function constArrayMembers(file: string, marker: string): string[] {
  const text = readFileSync(file, 'utf8')
  const start = text.indexOf(marker)
  assert.ok(start > -1, `${relative(ROOT, file)} 中找不到 ${marker}`)
  const block = text.slice(start, text.indexOf('] as const', start))
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
}

const clientTypes = constArrayMembers(
  join(ROOT, 'app/composables/cloudSyncRegistry.ts'),
  'export const CLOUD_DATA_TYPES = [',
)
const serverTypes = constArrayMembers(
  join(ROOT, 'server/utils/dataAccess.ts'),
  'export const CLOUD_DATA_TYPES = [',
)

/** 前端各 store 里实际的 useCloudSync('<type>') 调用点 */
const callSites = sourceFiles(join(ROOT, 'app'))
  .flatMap((file) => {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(/useCloudSync\(\s*'([^']+)'/g)].map((m) => ({
      type: m[1]!,
      file: relative(ROOT, file),
    }))
  })
  .filter((site) => !site.file.includes('composables/useCloudSync.ts'))

describe('云同步类型契约', () => {
  test('前后端类型白名单一致（前端加了 store 必须同步放行服务端）', () => {
    assert.deepEqual([...clientTypes].sort(), [...serverTypes].sort())
  })

  test('每个 useCloudSync 调用点的 type 都在白名单内（否则同步会被服务端拒绝）', () => {
    for (const site of callSites) {
      assert.ok(serverTypes.includes(site.type), `${site.file} 同步了未放行的类型 "${site.type}"`)
    }
  })

  test('白名单里没有无人使用的死类型', () => {
    const used = new Set(callSites.map((s) => s.type))
    for (const type of clientTypes) {
      assert.ok(used.has(type), `类型 "${type}" 在白名单中但没有任何 store 使用`)
    }
  })

  test('每个参与同步的 store 都已登记进注册表（防 note 漏注册那类丢数据事故）', () => {
    const registry = readFileSync(join(ROOT, 'app/composables/cloudSyncRegistry.ts'), 'utf8')
    for (const site of callSites) {
      assert.ok(
        registry.includes(`${site.type}:`),
        `注册表缺少 "${site.type}"：该类型不会在登录/自动登录时被拉取，` +
          `且本端下一次改动会整包覆盖云端数据`,
      )
    }
  })

  test('页面加载路径调用注册表，而不是手写某几个 store（自动登录与交互式登录需一致）', () => {
    const page = readFileSync(join(ROOT, 'app/pages/index.vue'), 'utf8')
    assert.match(page, /initAllCloudSync\(\)/)
    assert.ok(
      !/useNoteStore\(\)\.initCloudSync|useTodoStore\(\)\.initCloudSync/.test(page),
      'index.vue 不应再逐个手写 store 初始化，改用注册表',
    )
  })
})

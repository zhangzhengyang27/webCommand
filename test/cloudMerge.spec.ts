import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeKeyed,
  mergeTombstones,
  pruneTombstones,
  localIsFresher,
  TOMBSTONE_RETENTION_MS,
} from '../app/composables/cloudMerge.ts'

interface Item {
  id: string
  name?: string
  updateTime?: number
}

const byId = (i: Item) => i.id

/**
 * 墓碑有 30 天保留窗口，用例时间必须落在窗口内。
 * 用真实时刻的分钟偏移而不是裸小数值，否则删除记录会被当成过期项剪掉，
 * 测试就会在错误的前提下「通过」。
 */
const NOW = Date.now()
const T = (minutesAgo: number) => NOW - minutesAgo * 60 * 1000

describe('mergeKeyed：跨设备逐条合并', () => {
  test('两端各自新增的条目都保留（不再整包覆盖）', () => {
    const cloud: Item[] = [{ id: 'a', updateTime: T(30) }]
    const local: Item[] = [{ id: 'b', updateTime: T(10) }]
    const { items } = mergeKeyed(cloud, local, byId)
    assert.deepEqual(items.map((i) => i.id).sort(), ['a', 'b'])
  })

  test('同一 id 由 updateTime 更晚的一方胜出', () => {
    const cloud: Item[] = [{ id: 'a', name: '云端版', updateTime: T(20) }]
    const local: Item[] = [{ id: 'a', name: '本地版', updateTime: T(5) }]
    const { items } = mergeKeyed(cloud, local, byId)
    assert.equal(items.length, 1)
    assert.equal(items[0]!.name, '本地版')
  })

  test('本端删除的条目不会因为另一端还留着而复生', () => {
    const cloud: Item[] = [{ id: 'a', updateTime: T(60) }]
    const local: Item[] = []
    const { items } = mergeKeyed(cloud, local, byId, {}, { a: T(10) })
    assert.deepEqual(items, [])
  })

  test('云端删除同样在本地生效', () => {
    const cloud: Item[] = []
    const local: Item[] = [{ id: 'a', updateTime: T(60) }]
    const { items } = mergeKeyed(cloud, local, byId, { a: T(10) })
    assert.deepEqual(items, [])
  })

  test('删掉之后重新创建：条目修改时间更晚则保留', () => {
    const cloud: Item[] = []
    const local: Item[] = [{ id: 'a', name: '重建', updateTime: T(1) }]
    const { items } = mergeKeyed(cloud, local, byId, { a: T(10) })
    assert.equal(items.length, 1)
    assert.equal(items[0]!.name, '重建')
  })

  test('超出保留窗口的墓碑不再压制条目（删除记录已被清理）', () => {
    const ancient = NOW - TOMBSTONE_RETENTION_MS - 60 * 1000
    const cloud: Item[] = [{ id: 'a', updateTime: ancient - 1000 }]
    const { items } = mergeKeyed(cloud, [], byId, {}, { a: ancient })
    assert.equal(items.length, 1)
  })

  test('历史数据（无 updateTime）不与本地新改动争胜', () => {
    const cloud: Item[] = [{ id: 'a', name: '旧格式' }]
    const local: Item[] = [{ id: 'a', name: '本地改动', updateTime: T(5) }]
    const { items } = mergeKeyed(cloud, local, byId)
    assert.equal(items[0]!.name, '本地改动')
  })

  test('同一 key 的墓碑取更晚的删除时间', () => {
    const merged = mergeTombstones({ a: T(30) }, { a: T(5), b: T(10) })
    assert.deepEqual(merged, { a: T(5), b: T(10) })
  })

  test('超出保留窗口的墓碑被清理，避免删除记录无限增长', () => {
    const deleted = { fresh: NOW - 1000, stale: NOW - TOMBSTONE_RETENTION_MS - 1000 }
    assert.deepEqual(pruneTombstones(deleted, NOW), { fresh: NOW - 1000 })
  })
})

describe('localIsFresher：配置类 blob 的整体新鲜度', () => {
  test('云端为旧格式（无 updatedAt）时本地优先，随后由本地上传补齐新格式', () => {
    assert.equal(localIsFresher({}, 0), true)
    assert.equal(localIsFresher(null, 0), true)
  })

  test('云端更新时采纳云端', () => {
    assert.equal(localIsFresher({ updatedAt: T(1) }, T(10)), false)
  })
})

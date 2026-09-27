import { describe, expect, it } from 'vitest'
import {
  redactSensitiveText,
  sanitizeForSnapshot,
  COMPONENT_OMITTED_TEXT,
} from '../../app/components/outputSnapshot'

/**
 * 输出快照清洗。这里的回归很具体：命令行的 resultList 里嵌着组件输出，
 * 早先的实现在处理 type: 'command' 时提前返回、没递归进去，
 * 于是 defineAsyncComponent 的对象被 JSON 化成空壳存进 localStorage，
 * 刷新恢复后 help / todo list 等输出全部变空白。
 */
describe('sanitizeForSnapshot', () => {
  it('组件输出换成占位文本', () => {
    expect(sanitizeForSnapshot({ type: 'component', component: {} })).toEqual({
      type: 'text',
      text: COMPONENT_OMITTED_TEXT,
    })
  })

  it('命令行里嵌套的组件输出同样要被清掉（曾经的回归点）', () => {
    const row = {
      type: 'command',
      text: 'help',
      collapsible: true,
      resultList: [{ type: 'component', component: { name: 'AsyncComponentWrapper' } }],
    }
    const cleaned = sanitizeForSnapshot(row) as typeof row
    expect(cleaned.resultList).toHaveLength(1)
    expect(cleaned.resultList![0]).toEqual({ type: 'text', text: COMPONENT_OMITTED_TEXT })
    expect(JSON.stringify(cleaned)).not.toContain('AsyncComponentWrapper')
  })

  it('嵌套再深一层也能清（resultList 里还是带 resultList 的行）', () => {
    const row = {
      type: 'command',
      text: 'todo list',
      resultList: [
        {
          type: 'command',
          text: 'todo list -a',
          resultList: [{ type: 'component', component: { name: 'TodoBox' } }],
        },
      ],
    }
    expect(JSON.stringify(sanitizeForSnapshot(row))).not.toContain('TodoBox')
  })

  it('命令回显里的密码被脱敏，其他文本不动', () => {
    const row = sanitizeForSnapshot({
      type: 'command',
      text: 'user login -p s3cr3t --password=abc123',
      resultList: [{ type: 'text', text: '登录成功' }],
    }) as { text: string; resultList: { text: string }[] }
    expect(row.text).toBe('user login -p *** --password=***')
    expect(row.resultList[0]!.text).toBe('登录成功')
  })

  it('普通文本输出原样保留', () => {
    const out = { type: 'text', text: '共 2 个任务', status: 'info' }
    expect(sanitizeForSnapshot(out)).toEqual(out)
  })

  it('非对象与 null 直接丢弃（调用方按 filter(Boolean) 剔除）', () => {
    expect(sanitizeForSnapshot(null)).toBe(null)
    expect(sanitizeForSnapshot(undefined)).toBe(null)
    expect(sanitizeForSnapshot('text')).toBe(null)
    expect(sanitizeForSnapshot(42)).toBe(null)
  })
})

describe('redactSensitiveText', () => {
  it('覆盖 -p / --password / 等号与空格四种写法', () => {
    expect(redactSensitiveText('user login -p abc')).toBe('user login -p ***')
    expect(redactSensitiveText('user login -p=abc')).toBe('user login -p=***')
    expect(redactSensitiveText('user passwd --password hello --newPassword x')).toBe(
      'user passwd --password *** --newPassword x',
    )
  })

  it('不含凭据的文本与空串原样返回', () => {
    expect(redactSensitiveText('todo add 买牛奶')).toBe('todo add 买牛奶')
    expect(redactSensitiveText('')).toBe('')
  })
})

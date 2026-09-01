import { defineStore } from 'pinia'
import type { SpaceItemType, SpaceType } from './spaceCommands'
import myAxios from '../../../utils/myAxios'
import { useUserStore } from '../user/userStore'

// 云端同步防抖定时器
let spaceSyncTimer: ReturnType<typeof setTimeout> | undefined
// 已初始化云同步的用户 id 与订阅取消函数（换账号时需重新拉取云端数据并解除旧订阅，防止数据串写）
let spaceSyncUserId: string | number | null = null
let unsubscribeSpaceSync: (() => void) | null = null

/**
 * 空间状态（类似文件系统实现）
 */
export const useSpaceStore = defineStore('space', {
  state: () => ({
    // 空间
    space: {
      // 默认包含根目录
      '/': {
        name: '/',
        dir: '/',
        type: 'dir',
      },
    } as SpaceType,
    // 当前所在目录
    currentDir: '/',
  }),
  getters: {},
  // 持久化
  persist: {
    key: 'space-store',
    storage: window.localStorage,
    beforeRestore: (_context) => {
      console.log('加载空间数据开始')
    },
    afterRestore: (_context) => {
      console.log('加载空间数据结束')
    },
  },
  actions: {
    /**
     * 获取单条目
     * @param key
     */
    getItem(key: string) {
      const fullPath = getFullPath(this.currentDir, key)
      return this.space[fullPath]
    },
    /**
     * 获取某目录下的条目
     * @param dir 目录
     * @param recursive 是否递归
     */
    listItems(dir?: string, recursive = false): SpaceItemType[] {
      if (!dir) {
        dir = this.currentDir
      } else {
        dir = getFullPath(this.currentDir, dir)
      }
      const resultList: SpaceItemType[] = []
      // 父目录层级
      const parentDirDepth = getItemDepth(dir)
      // 查询 dir 下的 item
      for (const key in this.space) {
        // 不列举自身
        if (key === dir) {
          continue
        }
        // 前缀必须匹配
        if (!key.startsWith(dir)) {
          continue
        }
        // 不递归，只展示直接子级
        if (!recursive) {
          // 直接子级的 '/' 数比父级多 1
          if (getItemDepth(key) - 1 === parentDirDepth) {
            resultList.push(this.space[key])
          }
        } else {
          resultList.push(this.space[key])
        }
      }
      return resultList
    },
    /**
     * 添加条目
     * @param item
     */
    addItem(item: SpaceItemType) {
      const fullPath = getFullPath(item.dir, item.name)
      // 目录不存在
      if (!this.space[item.dir]) {
        return false
      }
      // 文件已存在 todo 支持覆盖
      if (this.space[fullPath]) {
        return false
      }
      this.space[fullPath] = item
      return true
    },
    /**
     * 删除条目
     * @param key
     * @param recursive
     */
    deleteItem(key: string, recursive = false) {
      const fullPath = getFullPath(this.currentDir, key)
      // 目录不存在
      if (!this.space[fullPath]) {
        return false
      }
      const deleteKeyList = [fullPath]
      // 需要递归删除
      if (recursive) {
        for (const spaceKey in this.space) {
          if (
            spaceKey !== fullPath &&
            (spaceKey.startsWith(fullPath + '/') || (fullPath === '/' && spaceKey.startsWith('/')))
          ) {
            deleteKeyList.push(spaceKey)
          }
        }
      }
      // 移除属性（deleteKey 为动态路径）
      deleteKeyList.forEach((deleteKey) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.space[deleteKey]
      })
      return true
    },
    /**
     * 复制条目
     * @param source
     * @param target
     * @param recursive
     */
    copyItem(source: string, target: string, recursive = false) {
      // e.g. /a/b => /a/c
      const sourceFullPath = getFullPath(this.currentDir, source)
      const targetFullPath = getFullPath(this.currentDir, target)
      // 源条目不存在
      const sourceItem = this.space[sourceFullPath]
      if (!sourceItem) {
        return false
      }
      // 复制目录必须开启递归
      if (sourceItem.type === 'dir' && !recursive) {
        return false
      }
      // 目标条目已存在
      if (this.space[targetFullPath]) {
        return false
      }
      // 目标目录不存在
      const targetParentDir = getParentDir(targetFullPath)
      if (!this.space[targetParentDir]) {
        return false
      }
      const targetItem = { ...sourceItem }
      targetItem.dir = targetParentDir
      targetItem.name = getItemName(targetFullPath)
      const result = this.addItem(targetItem)
      if (!result) {
        return false
      }
      // 递归复制子条目
      if (recursive && sourceItem.type === 'dir') {
        for (const spaceKey in this.space) {
          if (spaceKey !== sourceFullPath && spaceKey.startsWith(sourceFullPath + '/')) {
            const childItem = { ...this.space[spaceKey] }
            const childRelativePath = spaceKey.substring(sourceFullPath.length)
            const newChildPath = targetFullPath + childRelativePath
            const newChildDir = getParentDir(newChildPath)
            childItem.dir = newChildDir
            childItem.name = getItemName(newChildPath)
            this.space[newChildPath] = childItem
          }
        }
      }
      return true
    },
    /**
     * 移动条目（等同于复制 + 删除）
     * @param source
     * @param target
     * @param recursive
     */
    moveItem(source: string, target: string, recursive = false) {
      let result = this.copyItem(source, target, recursive)
      if (result) {
        result = this.deleteItem(source, recursive)
      }
      return result
    },
    /**
     * 更新当前所在目录
     * @param newDir
     */
    updateCurrentDir(newDir: string) {
      let fullPath = getFullPath(this.currentDir, newDir)
      // 上层目录
      if (newDir === '..') {
        // 已经是根目录，无法到上层
        if (this.currentDir === '/') {
          return false
        } else {
          fullPath = getParentDir(this.currentDir)
        }
      }
      // 目录不存在
      if (!this.space[fullPath]) {
        return false
      }
      this.currentDir = fullPath
      return true
    },
    /**
     * 同步到云端（登录后）(#25)
     */
    syncToCloud() {
      const userStore = useUserStore()
      if (!userStore.loginUser?.id) {
        return
      }
      if (spaceSyncTimer) {
        clearTimeout(spaceSyncTimer)
      }
      spaceSyncTimer = setTimeout(() => {
        myAxios
          .post('/data/sync', {
            type: 'space',
            content: JSON.stringify({
              space: this.space,
              currentDir: this.currentDir,
            }),
          })
          .catch((e) => console.error('space 同步失败', e))
      }, 800)
    },
    /**
     * 从云端加载，与本地未同步条目合并（避免覆盖丢失）(#25)
     */
    async loadFromCloud() {
      const userStore = useUserStore()
      if (!userStore.loginUser?.id) {
        return
      }
      try {
        const res: any = await myAxios.get('/data?type=space')
        if (res?.code === 0 && res.data) {
          const data = JSON.parse(res.data)
          if (data && data.space) {
            // 合并：以云端为基准，保留云端没有的本地条目
            const merged = { ...data.space }
            for (const k in this.space) {
              if (!merged[k]) {
                merged[k] = this.space[k]
              }
            }
            if (!merged['/']) {
              merged['/'] = this.space['/']
            }
            this.space = merged
            this.currentDir = data.currentDir || '/'
          }
        }
      } catch (e) {
        console.error('space 加载失败', e)
      }
    },
    /**
     * 初始化云端同步：先拉取，再订阅后续变更 (#25)
     * 按用户幂等：同一用户重复调用不重复注册 $subscribe；换用户时先解除旧订阅再重新拉取
     */
    initCloudSync() {
      const userStore = useUserStore()
      const userId = userStore.loginUser?.id
      if (!userId) {
        return
      }
      if (spaceSyncUserId === userId) {
        return
      }
      this.resetCloudSync()
      spaceSyncUserId = userId
      this.loadFromCloud().finally(() => {
        unsubscribeSpaceSync = this.$subscribe(() => this.syncToCloud())
      })
    },
    /**
     * 重置云同步：解除订阅并清除初始化标记（注销时调用）
     */
    resetCloudSync() {
      if (unsubscribeSpaceSync) {
        unsubscribeSpaceSync()
        unsubscribeSpaceSync = null
      }
      spaceSyncUserId = null
    },
    /**
     * 从备份导入（覆盖当前数据）
     */
    importBackup(data: any) {
      if (data?.space && typeof data.space === 'object') {
        this.space = data.space
      }
      if (typeof data?.currentDir === 'string') {
        this.currentDir = data.currentDir
      }
      this.syncToCloud()
    },
  },
})

/**
 * 获得条目全路径
 * @param dir 目录
 * @param name 条目名称（位置）
 */
const getFullPath = (dir: string, name: string): string => {
  if (name.startsWith('/')) {
    return name
  }
  return dir + (dir === '/' ? '' : '/') + name
}

/**
 * 获取上层路径
 * @param path
 */
const getParentDir = (path: string): string => {
  let parentDir = '/'
  if (path === '/') {
    return parentDir
  }
  // 切割掉最后一个 '/'
  // e.g. /a/b => /a
  parentDir = path.substring(0, path.lastIndexOf('/'))
  // 有可能回退到根目录
  // e.g. /a => ''（空字符串）
  if (!parentDir) {
    return '/'
  }
  return parentDir
}

/**
 * 根据路径获取空间条目名
 * @param path
 */
const getItemName = (path: string): string => {
  if (path === '/') {
    return path
  }
  // 从最后一个 '/' 开始取字符串
  // e.g. /a/b => b
  return path.substring(path.lastIndexOf('/') + 1)
}

/**
 * 获得条目层级
 * @param key
 */
const getItemDepth = (key: string) => {
  if (key === '/') {
    return 1
  }
  return key.split('/').length
}

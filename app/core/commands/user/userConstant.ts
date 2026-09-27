import UserType = User.UserType

/**
 * 本地用户
 */
export const LOCAL_USER: UserType = {
  username: 'local',
}

/**
 * 新设口令的最小长度。必须与 server/utils/accountPolicy.ts 的同名常量一致
 * （有契约测试比对两处取值），否则前端提示与实际校验会脱节。
 */
export const MIN_PASSWORD_LENGTH = 8

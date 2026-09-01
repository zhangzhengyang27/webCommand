declare namespace User {
  /**
   * 用户类型
   */
  interface UserType {
    id?: number;
    username: string;
    email?: string;
    createTime?: Date;
    updateTime?: Date;
  }
}

# webCommand — Nuxt 4 SPA + Nitro API（node-server preset）
# 端口 3000（容器内）→ 4900（宿主机）→ frp → VPS Nginx → https://command.zhangzhengyang.com
FROM node:22-slim

WORKDIR /app

# .output/server 已自包含（含 node_modules），容器内无需再安装依赖
COPY . .

# sequelize 动态加载 mysql2，Nitro 未将其打包进 .output/server/node_modules，需单独安装
# 在临时目录安装再合并拷贝，避免 npm 与现有 node_modules 树冲突（edgesOut 报错）
RUN mkdir -p /tmp/mysql2 && cd /tmp/mysql2 && npm init -y >/dev/null 2>&1 && \
    npm install mysql2@3.24.2 --registry=https://registry.npmmirror.com && \
    cp -a /tmp/mysql2/node_modules/. /app/node_modules/

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", ".output/server/index.mjs"]

# Cloudflare Pages 部署指南

本项目是 "图生3D" 模块的独立版，已剔除登录和历史记录依赖，可直接部署在 Cloudflare Pages 上。

## 1. 本地测试

```bash
# 进入目录
cd image-to-3d-standalone

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 2. 部署到 Cloudflare Pages

### 方法 A: 使用命令行 (推荐)

1. 安装 Wrangler: `npm install -g wrangler`
2. 登录 Cloudflare: `wrangler login`
3. 构建项目: `npm run build`
4. 部署: `wrangler pages deploy dist`

### 方法 B: 连接 GitHub/GitLab

1. 将 `image-to-3d-standalone` 文件夹初始化为新的 Git 仓库并推送到 GitHub。
2. 在 Cloudflare 控制台 -> Workers & Pages -> Create application -> Pages -> Connect to git。
3. 选择你的仓库。
4. 构建设置：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. 设置环境变量 (可选):
   - `VITE_SHARP_API_BASE_URL`: 设置为你自定义的后端地址。

## 3. 注意事项

- **CORS**: 确保你的后端服务器 (`seetacloud.com`) 允许来自你 CF Pages 域名的跨域请求。
- **文件大小**: 默认前端限制为 1GB，但 Cloudflare 或后端网关可能有更小的限制。


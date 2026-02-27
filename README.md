# Image to 3D Standalone

这是一个从美术中台提取出的独立工具，用于将 2D 图片转换为 3D 模型 (.ply)。

## 特性
- **独立运行**: 不依赖原项目的数据库、登录系统和 API 转发。
- **环境隔离**: 仅包含图生 3D 的核心逻辑。
- **CF Pages 优化**: 极其轻量，适合部署在 Cloudflare Pages。

## 本地开发

```bash
# 进入目录
cd image-to-3d-standalone

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 部署到 Cloudflare Pages

### 方式 A: 命令行部署 (Wrangler)
1. 安装 Wrangler: `npm install -g wrangler`
2. 构建项目: `npm run build`
3. 部署: `wrangler pages deploy dist`

### 方式 B: GitHub 自动部署 (推荐)
1. 将 `image-to-3d-standalone` 文件夹初始化为新的 Git 仓库并推送到 GitHub。
2. 在 Cloudflare 控制台选择 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 构建设置：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 环境变量设置 (可选):
   - `VITE_SHARP_API_BASE_URL`: 指向你的后端 API 地址。

## 注意事项
- **CORS**: 请确保你的后端 API (`u184490-b122...seetacloud.com`) 允许来自你 CF Pages 域名的跨域请求。
- **文件限制**: 前端限制最大上传为 1GB，但实际取决于后端网关配置。


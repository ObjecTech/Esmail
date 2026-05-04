# Esmail

Esmail 仓库包含两个部分：

- `app/`: Esmail Web App，支持 Gmail / QQ 邮箱登录、邮件列表、AI 摘要、AI 起草、待办和自定义分类。
- `plugin/`: 浏览器插件版本，保留为独立项目。

## 线上访问

当前线上 App 地址：

https://esmail-demo.vercel.app

如果刚推送了新代码但线上页面还没更新，通常需要等待 Vercel 自动部署完成。也可以在 Vercel 项目里查看最新 Production Deployment。

## 本地运行 App

进入 App 目录：

```bash
cd app
npm install
cp .env.example .env
```

编辑 `app/.env`，至少配置：

```bash
API_PORT=5175
FRONTEND_ORIGIN=http://127.0.0.1:5174
CHATANYWHERE_API_KEY=你的 ChatAnywhere API key
CHATANYWHERE_BASE_URL=https://api.chatanywhere.tech/v1
AI_MODEL=gpt-5-mini
```

Google 登录有两种配置方式，二选一：

```bash
GOOGLE_CLIENT_ID=你的 Google OAuth Client ID
GOOGLE_CLIENT_SECRET=你的 Google OAuth Client Secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5175/api/auth/google/callback
```

或者把 Google Cloud 下载的 `client_secret_*.json` 放到 `app/` 根目录。不要提交 `.env` 或 `client_secret_*.json`。

Google Cloud Console 里需要把下面地址加入 OAuth Client 的 Authorized redirect URIs：

```text
http://127.0.0.1:5175/api/auth/google/callback
```

启动本地后端：

```bash
npm run dev:api
```

另开一个终端启动前端：

```bash
npm run dev:lan
```

打开：

```text
http://127.0.0.1:5174
```

QQ 邮箱登录不需要提前写服务器环境变量。页面中输入 QQ 邮箱地址和邮箱授权码即可，授权码不是 QQ 密码，需要在 QQ 邮箱设置中生成。

## 更新线上链接

本仓库的 App 适合部署到 Vercel。线上部署时，Vercel 项目的 Root Directory 应指向：

```text
app
```

Vercel 环境变量建议配置：

```bash
FRONTEND_ORIGIN=https://esmail-demo.vercel.app
CHATANYWHERE_API_KEY=你的 ChatAnywhere API key
CHATANYWHERE_BASE_URL=https://api.chatanywhere.tech/v1
AI_MODEL=gpt-5-mini
GOOGLE_CLIENT_ID=你的 Google OAuth Client ID
GOOGLE_CLIENT_SECRET=你的 Google OAuth Client Secret
GOOGLE_REDIRECT_URI=https://esmail-demo.vercel.app/api/auth/google/callback
SESSION_SECRET=一段足够长的随机字符串
```

同时在 Google Cloud Console 的 Authorized redirect URIs 中加入线上回调地址：

```text
https://esmail-demo.vercel.app/api/auth/google/callback
```

如果 Vercel 已经连接 GitHub 仓库，推送到 `main` 后会自动触发线上部署。如果需要手动部署：

```bash
cd app
npm install
npm run build
npx vercel --prod
```

部署完成后，使用 Vercel 输出的 Production URL 访问；如果使用自定义域名，把 `FRONTEND_ORIGIN` 和 `GOOGLE_REDIRECT_URI` 中的域名同步改成自定义域名。

## 常用命令

```bash
cd app
npm test
npm run build
```

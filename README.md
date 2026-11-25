# 经验迁移 Lab

填写目标和背景，获得有来源的迁移判断、行动流程及关键节点的失败预案。提示词由模型按当前输入生成，报告结合检索到的经验摘要。界面保留刘看山动效与可横向切换的报告卡片。

## 部署到自己的服务器

需要 Docker 和 Docker Compose。

1. 克隆你上传的仓库，进入项目目录，执行 `cp .env.example .env`。
2. 在 `.env` 设置至少 16 个字符的 `ADMIN_PASSWORD`，可以用 `openssl rand -hex 16` 生成。用 `openssl rand -hex 32` 生成 `APP_SECRET`。
3. 在服务器上执行下面的命令。

```sh
docker compose up -d --build
docker compose ps
```

服务默认监听服务器的 `127.0.0.1:3000`。如果你用 Nginx 等反向代理，将域名通过 HTTPS 转发到该地址，并把 `APP_ORIGIN` 设成对外的 HTTPS 地址，例如 `https://lab.example.com`。修改 `APP_PORT` 时请同步修改反向代理的上游端口。管理后台只接受配置的页面来源。

远程服务器暂时没有域名时，可在电脑上执行 `ssh -L 3000:127.0.0.1:3000 用户名@服务器地址`，再打开 `http://127.0.0.1:3000/admin/keys`。这个用法对应模板默认的 `APP_ORIGIN`。

### 配置 API 凭证

打开 `/admin/keys`，用管理密码登录。填入知乎 Access Secret 和 DeepSeek API Key 后保存。更换一项时可将另一项留空。后台只显示配置状态，普通页面的下一次请求会使用保存的配置。

`lab-data` 卷保存加密凭证，更新镜像后仍会保留。备份时保留这个卷和对应的 `APP_SECRET`，恢复时需要同时使用两者。用 `docker compose down` 停止服务可以保留卷。升级时拉取代码后重新执行 `docker compose up -d --build`。

| 变量 | 用途 |
| --- | --- |
| `APP_PORT` | 服务器回环监听端口，默认 3000 |
| `APP_ORIGIN` | 后台在浏览器中使用的完整来源，含协议及非默认端口 |
| `ADMIN_PASSWORD` | 管理密码，至少 16 个字符 |
| `APP_SECRET` | 64 个十六进制字符，用于加密凭证和签名会话 |
| `MODEL_API_BASE_URL` | 模型服务的 OpenAI 兼容基础地址，默认 DeepSeek |
| `MODEL_NAME` | 模型名，默认 `deepseek-flash`。需要支持 Chat Completions JSON 模式 |

## 本地开发

使用 Node.js 24。

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

本地也可以复制 `.env.example` 为 `.env`，设置管理密码与 `APP_SECRET` 后访问 `/admin/keys`。配置前可以用 `/?demo=1` 预览应用及演示报告。生产版可用 `npm run build` 和 `npm start` 在本地验证。

## 推送到自己的 GitHub

在 GitHub 创建一个空仓库，然后在这个工程目录执行：

```sh
git remote add origin <你的仓库地址>
git push -u origin HEAD:main
```

仓库包含部署模板。服务器的 `.env` 和凭证数据由部署环境保管。

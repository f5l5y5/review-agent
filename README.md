# GitLab MR AI Code Review

基于 NestJS 的 GitLab Merge Request AI 代码审查服务，支持自动代码审查和钉钉通知。

## 功能特性

- **自动代码审查**：接收 GitLab Webhook 事件，自动触发 AI 代码审查
- **多种审查模式**：支持快速、标准、深度三种审查模式
- **智能分批处理**：大型 MR 自动分批处理，避免超时
- **钉钉通知**：审查结果自动推送到钉钉群
- **安全验证**：支持 Webhook Token 验证

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
# 创建 .env 文件并填入相关配置

# 启动服务
pnpm run start:dev
```

详细配置请参考 [快速开始指南](QUICKSTART.md)。

## 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `GITLAB_TOKEN` | 是 | GitLab Personal Access Token |
| `GITLAB_WEBHOOK_TOKEN` | 否 | GitLab Webhook 验证 Token |
| `AI_SERVICE_URL` | 是 | AI 服务 API 地址 |
| `AI_TOKEN` | 是 | AI 服务 API Token |
| `AI_MODEL` | 否 | AI 模型名称（默认: gpt-4） |
| `MAX_FILES_PER_REVIEW` | 否 | 每批最大文件数（默认: 20） |
| `MAX_DIFF_LINES_PER_FILE` | 否 | 单文件最大 diff 行数（默认: 500） |

## 项目结构

```
src/
├── app.module.ts           # 应用模块
└── modules/
    └── webhook/
        ├── ai-review.service.ts      # AI 审查服务
        ├── config.service.ts         # 配置服务
        ├── gitlab.service.ts         # GitLab API 服务
        ├── notification.service.ts   # 通知服务
        ├── webhook.controller.ts     # Webhook 控制器
        ├── webhook.guard.ts          # Webhook 守卫
        ├── webhook.module.ts         # Webhook 模块
        └── webhook.service.ts        # Webhook 服务
```

## API 接口

### POST /webhook/trigger

接收 GitLab Merge Request 事件，触发代码审查。

**请求头**：
- `X-Gitlab-Token`: Webhook 验证 Token（可选）
- `x-push-url`: 钉钉通知 Webhook URL（可选）

## 文档

- [快速开始指南](QUICKSTART.md)
- [优化说明](OPTIMIZATION.md)

## License

MIT

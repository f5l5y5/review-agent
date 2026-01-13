# AI Code Review - 快速开始指南

## 📋 前置要求

- Node.js >= 16
- GitLab 账号和 Personal Access Token
- AI 服务 API Token（如 OpenAI API Key、Azure OpenAI Key 等）
- 钉钉机器人 Webhook URL（可选）

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件，填入以下配置：

```env
# 必需配置
GITLAB_TOKEN=glpat-xxxxxxxxxxxx
AI_SERVICE_URL=https://api.openai.com/v1/chat/completions
AI_TOKEN=sk-xxxxxxxxxxxx

# 可选配置
GITLAB_WEBHOOK_TOKEN=your_secret_token
AI_MODEL=gpt-4
MAX_FILES_PER_REVIEW=20
```

### 3. 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

服务将在 `http://localhost:3000` 启动。

### 4. 配置 GitLab Webhook

1. 进入 GitLab 项目 → Settings → Webhooks
2. 填写配置：
   - **URL**: `http://your-domain.com/webhook/trigger`
   - **Secret Token**: 与 `.env` 中的 `GITLAB_WEBHOOK_TOKEN` 一致
   - **Trigger**: 勾选 "Merge request events"
   - **SSL verification**: 根据实际情况选择

3. 添加自定义 Header（可选）：
   - Key: `x-push-url`
   - Value: 你的钉钉机器人 Webhook URL

4. 点击 "Add webhook"

### 5. 测试

创建一个 Merge Request，系统将自动：
1. 接收 GitLab Webhook 事件
2. 获取 MR 的 diff 内容
3. 调用 AI 进行代码审查
4. 发送审查结果到钉钉

## 📊 审查模式说明

### Quick Mode（快速模式）
- 关注明显的语法错误和逻辑错误
- 检查严重的安全漏洞
- 适合快速反馈

### Standard Mode（标准模式，默认）
- 平衡详细程度和速度
- 检查代码质量、安全问题、性能
- 适合日常使用

### Deep Mode（深度模式）
- 全面评估代码质量
- 包含测试覆盖、文档等
- 适合重要功能的审查

## 🔧 高级配置

### 调整分批处理

当 MR 包含大量文件时，系统会自动分批处理。可以通过环境变量调整：

```env
# 每批最多处理的文件数
MAX_FILES_PER_REVIEW=20

# 单个文件最大 diff 行数
MAX_DIFF_LINES_PER_FILE=500
```

### 自定义审查模式

在 [webhook.service.ts](src/modules/webhook/webhook.service.ts) 中修改：

```typescript
import { ReviewMode } from './ai-review.service';

// 使用深度审查模式
const reviewResult = await this.aiReviewService.reviewMergeRequest(
  diffResult,
  ReviewMode.DEEP
);
```

## 📝 钉钉通知示例

审查完成后，钉钉将收到如下格式的消息：

```
# 🟢 代码审查报告

**评分**: 8/10

**总体评语**: 代码质量良好，有少量改进建议

### 详细意见

🟡 **src/app.service.ts**
- 建议添加错误处理
- 函数复杂度较高，建议拆分

🟢 **src/utils/helper.ts**
- 代码规范，无明显问题

---

**项目**: my-project
**MR**: [Add new feature](https://gitlab.com/...)
**作者**: Zhang San
**文件数**: 5 个代码文件（总计 8 个文件）
```

## 🐛 常见问题

### Q: AI 服务调用失败？
A: 检查以下几点：
- `AI_SERVICE_URL` 是否正确
- `AI_TOKEN` 是否已配置且有效
- API Key 是否有足够的配额
- 网络连接是否正常
- 查看日志中的详细错误信息

### Q: GitLab API 调用失败？
A: 确认：
- `GITLAB_TOKEN` 是否有 `api` 权限
- Token 是否过期

### Q: 没有收到钉钉通知？
A: 检查：
- `x-push-url` Header 是否正确配置
- 钉钉机器人 Webhook URL 是否有效
- 查看服务日志中的通知发送状态

### Q: 审查结果不准确？
A: 可以尝试：
- 切换到 `DEEP` 模式进行更详细的审查
- 调整 AI 模型（如使用 GPT-4）
- 增加 `AI_MAX_TOKENS` 以获取更详细的结果

## 🔒 安全建议

1. **保护 Token**
   - 不要将 `.env` 文件提交到版本控制
   - 使用 `.gitignore` 忽略敏感文件

2. **启用 Webhook 验证**
   - 设置 `GITLAB_WEBHOOK_TOKEN`
   - 在 GitLab 中配置相同的 Secret Token

3. **限制网络访问**
   - 使用防火墙限制 Webhook 端点
   - 只允许 GitLab 服务器 IP 访问

4. **使用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 配置有效的 SSL 证书

## 📈 性能优化

1. **调整超时时间**
   ```env
   AI_TIMEOUT=120000  # 增加到 2 分钟
   ```

2. **减少文件数量**
   ```env
   MAX_FILES_PER_REVIEW=10  # 减少每批文件数
   ```

3. **限制 diff 大小**
   ```env
   MAX_DIFF_LINES_PER_FILE=300  # 减少单文件行数
   ```

## 📚 更多文档

- [优化说明](OPTIMIZATION.md) - 详细的优化内容和技术细节

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT

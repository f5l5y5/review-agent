# AI Code Review Agent - 优化说明

## 优化内容总结

### 1. **配置管理优化** ✅
- 创建了统一的 [ConfigService](src/modules/webhook/config.service.ts)
- 集中管理所有配置项（GitLab、AI、通知、审查）
- 支持配置验证和配置摘要输出

### 2. **通知服务解耦** ✅
- 创建了独立的 [NotificationService](src/modules/webhook/notification.service.ts)
- 支持多种通知渠道（钉钉、邮件）
- 使用 Markdown 格式优化钉钉消息展示
- 并行发送多个通知渠道

### 3. **错误处理和重试机制** ✅
- 创建了通用的 [重试工具](src/modules/webhook/retry.util.ts)
- 支持指数退避重试策略
- AI 服务调用自动重试（最多 3 次）
- GitLab API 调用自动重试
- 完善的错误日志记录

### 4. **AI 提示词优化** ✅
- 支持三种审查模式：
  - `QUICK` - 快速审查，关注明显问题
  - `STANDARD` - 标准审查（默认）
  - `DEEP` - 深度审查，全面评估
- 结构化的提示词模板
- 明确的评分标准
- 支持大 diff 自动截断

### 5. **分批处理优化** ✅
- 自动检测文件数量，超过阈值时分批处理
- 避免单次请求过大导致超时
- 智能合并多批次审查结果

### 6. **类型安全改进** ✅
- 消除了所有 `any` 类型
- 增强的 JSON 解析和数据验证
- 规范化评分、严重程度等字段

### 7. **Token 验证增强** ✅
- 创建了 [WebhookGuard](src/modules/webhook/webhook.guard.ts)
- 自动验证 GitLab Webhook Token
- 防止未授权访问

### 8. **日志记录完善** ✅
- 使用 NestJS Logger 替代 console.log
- 结构化的日志输出
- 关键操作的日志追踪

## 文件结构

```
src/modules/webhook/
├── ai-review.service.ts      # AI 审查服务（优化）
├── config.service.ts          # 配置服务（新增）
├── gitlab.service.ts          # GitLab API 服务（优化）
├── interfaces.ts              # 类型定义
├── notification.service.ts    # 通知服务（新增）
├── retry.util.ts              # 重试工具（新增）
├── webhook.controller.ts      # Webhook 控制器（优化）
├── webhook.guard.ts           # Token 验证守卫（新增）
├── webhook.module.ts          # 模块配置（更新）
└── webhook.service.ts         # Webhook 服务（优化）
```

## 环境变量配置

复制 `.env.example` 为 `.env` 并配置以下变量：

```bash
# GitLab 配置
GITLAB_API_URL=https://gitlab.com/api/v4
GITLAB_TOKEN=your_gitlab_personal_access_token
GITLAB_WEBHOOK_TOKEN=your_webhook_secret_token

# AI 服务配置
AI_SERVICE_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4
AI_MAX_RETRIES=3
AI_TIMEOUT=60000
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=4000

# 通知配置
ENABLE_DINGTALK=true
ENABLE_EMAIL=false

# 审查配置
MAX_FILES_PER_REVIEW=20
MAX_DIFF_LINES_PER_FILE=500
ENABLE_PARALLEL_REVIEW=false
```

## 使用方法

### 1. GitLab Webhook 配置

在 GitLab 项目设置中添加 Webhook：

- **URL**: `https://your-domain.com/webhook/trigger`
- **Secret Token**: 与 `GITLAB_WEBHOOK_TOKEN` 一致
- **Trigger**: 勾选 "Merge request events"
- **自定义 Headers**（可选）:
  - `x-push-url`: 钉钉机器人 Webhook URL

### 2. 审查模式选择

在 [webhook.service.ts:84](src/modules/webhook/webhook.service.ts#L84) 中可以修改审查模式：

```typescript
// 快速审查
const reviewResult = await this.aiReviewService.reviewMergeRequest(
  diffResult,
  ReviewMode.QUICK
);

// 标准审查（默认）
const reviewResult = await this.aiReviewService.reviewMergeRequest(diffResult);

// 深度审查
const reviewResult = await this.aiReviewService.reviewMergeRequest(
  diffResult,
  ReviewMode.DEEP
);
```

### 3. 通知渠道配置

#### 钉钉通知
- 通过 Webhook Header `x-push-url` 传递钉钉机器人 URL
- 或在环境变量中配置 `ENABLE_DINGTALK=true`

#### 邮件通知（待实现）
- 设置 `ENABLE_EMAIL=true`
- 配置 `EMAIL_FROM` 和 `EMAIL_TO`

## 核心功能特性

### 1. 智能分批处理
当 MR 包含大量文件时，自动分批审查：
- 默认每批最多 20 个文件
- 自动合并多批次结果
- 避免 AI 服务超时

### 2. 自动重试机制
- AI 服务调用失败自动重试（指数退避）
- GitLab API 调用失败自动重试
- 网络错误、超时、5xx 错误自动重试

### 3. 鲁棒的 JSON 解析
- 支持提取 Markdown 代码块中的 JSON
- 数据验证和规范化
- 解析失败时返回默认结果

### 4. 结构化日志
- 使用 NestJS Logger
- 关键操作的日志追踪
- 便于问题排查

## API 响应示例

### 成功响应
```json
{
  "success": true,
  "message": "Merge request event processed",
  "data": {
    "mr_id": 12345,
    "mr_iid": 1,
    "action": "open",
    "title": "Add new feature"
  }
}
```

### 审查结果格式
```json
{
  "score": 8,
  "summary": "代码质量良好，有少量改进建议",
  "fileReviews": [
    {
      "filePath": "src/app.ts",
      "comments": [
        "建议添加错误处理",
        "函数复杂度较高，建议拆分"
      ],
      "severity": "medium"
    }
  ]
}
```

## 性能优化建议

1. **调整分批大小**: 根据 AI 服务性能调整 `MAX_FILES_PER_REVIEW`
2. **限制 diff 行数**: 通过 `MAX_DIFF_LINES_PER_FILE` 控制单文件 diff 大小
3. **启用并行审查**: 设置 `ENABLE_PARALLEL_REVIEW=true`（实验性功能）
4. **调整超时时间**: 根据网络情况调整 `AI_TIMEOUT`

## 安全建议

1. **保护敏感信息**:
   - 不要将 `.env` 文件提交到版本控制
   - 使用环境变量管理敏感配置

2. **启用 Token 验证**:
   - 设置 `GITLAB_WEBHOOK_TOKEN`
   - 在 GitLab Webhook 配置中使用相同的 Secret Token

3. **限制访问**:
   - 使用防火墙限制 Webhook 端点访问
   - 只允许 GitLab 服务器 IP 访问

## 故障排查

### 1. AI 服务调用失败
- 检查 `AI_SERVICE_URL` 是否正确
- 验证 API Key 是否有效
- 查看日志中的重试信息

### 2. GitLab API 调用失败
- 检查 `GITLAB_TOKEN` 权限
- 确认 `GITLAB_API_URL` 正确
- 查看 GitLab API 速率限制

### 3. 通知发送失败
- 验证钉钉 Webhook URL 是否正确
- 检查网络连接
- 查看日志中的错误信息

## 后续优化方向

- [ ] 支持更多 LLM 提供商（Claude、Gemini 等）
- [ ] 实现邮件通知功能
- [ ] 添加审查结果缓存
- [ ] 支持自定义审查规则
- [ ] 添加审查历史记录
- [ ] 支持 GitLab 评论集成
- [ ] 添加性能监控和指标统计

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * 应用配置服务
 * 统一管理所有配置项
 */
@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);

  /**
   * GitLab 配置
   */
  readonly gitlab = {
    // Webhook 验证 token（通过 x-gitlab-token header 验证）
    webhookToken: process.env.GITLAB_WEBHOOK_TOKEN || '',
    // API token 回退值（优先使用 x-access-token header）
    token: process.env.GITLAB_TOKEN || '',
    // GitLab 实例基础地址（不包含 /api/v4）
    baseUrl: (process.env.GITLAB_BASE_URL || '').replace(/\/+$/, ''),
  };

  /**
   * AI 服务配置
   */
  readonly ai = {
    serviceUrl: process.env.AI_SERVICE_URL || '',
    token: process.env.AI_TOKEN || '',
    model: process.env.AI_MODEL || 'gpt-4',
    timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4000', 10),
  };

  /**
   * 审查配置
   */
  readonly review = {
    maxFilesPerReview: parseInt(process.env.MAX_FILES_PER_REVIEW || '20', 10),
    maxDiffLinesPerFile: parseInt(process.env.MAX_DIFF_LINES_PER_FILE || '500', 10),
  };

  /**
   * 验证必需的配置项
   */
  validate(): void {
    const errors: string[] = [];

    if (!this.ai.serviceUrl) {
      errors.push('AI_SERVICE_URL is required');
    }

    if (!this.gitlab.baseUrl) {
      errors.push('GITLAB_BASE_URL is required (e.g. https://gitlab.com)');
    }

    if (!this.gitlab.webhookToken) {
      errors.push('GITLAB_WEBHOOK_TOKEN is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  onModuleInit(): void {
    this.validate();
    this.logger.log('Configuration validation succeeded');
  }

  /**
   * 获取配置摘要（用于日志）
   */
  getSummary(): Record<string, any> {
    return {
      gitlab: {
        hasWebhookToken: !!this.gitlab.webhookToken,
        hasToken: !!this.gitlab.token,
        baseUrl: this.gitlab.baseUrl || 'Not configured',
      },
      ai: {
        serviceUrl: this.ai.serviceUrl,
        model: this.ai.model,
        timeout: this.ai.timeout,
      },
      review: {
        maxFilesPerReview: this.review.maxFilesPerReview,
        maxDiffLinesPerFile: this.review.maxDiffLinesPerFile,
      },
    };
  }
}

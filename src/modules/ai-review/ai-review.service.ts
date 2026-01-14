import { Injectable, Logger } from '@nestjs/common';
import type { GitLabMRDiff } from '../gitlab';
import type { AIReviewResult, Review } from './interfaces';
import { ConfigService } from '../config';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);
  private readonly cachePrompt: string;

  constructor(private readonly configService: ConfigService) {
    // 读取系统提示词
    const promptPath = join(__dirname, 'system-prompt.txt');
    this.cachePrompt = readFileSync(promptPath, 'utf-8');
  }

  /**
   * 审查 MR 代码
   */
  async reviewMergeRequest(
    diffResult: GitLabMRDiff,
  ): Promise<AIReviewResult> {
    const config = this.configService.ai;

    if (!config.serviceUrl) {
      throw new Error('AI_SERVICE_URL is not configured');
    }

    this.logger.log(
      `开始审查 MR #${diffResult.iid}，共 ${diffResult.changes.length} 个代码文件`,
    );

    try {
      const result = await this.singleReviewMergeRequest(diffResult);

      this.logger.log(
        `MR #${diffResult.iid} 审查完成，共发现 ${result.reviews.length} 个问题`,
      );

      return result;
    } catch (error) {
      this.logger.error(`MR #${diffResult.iid} 审查失败`, error);
      throw error;
    }
  }

  /**
   * 单次审查
   */
  private async singleReviewMergeRequest(
    diffResult: GitLabMRDiff,
  ): Promise<AIReviewResult> {
    // 构建 AI 请求
    const prompt = this.buildReviewPrompt(diffResult);

    const response = await this.callAI(prompt);

    // 解析 AI 响应
    return this.parseAIResponse(response);
  }


  /**
   * 构建审查提示词（用户消息）
   */
  private buildReviewPrompt(diffResult: GitLabMRDiff): string {
    const diffContent = diffResult.extendedContent || '';

    return `请审查以下 Merge Request 的代码变更：

\`\`\`diff
${diffContent}
\`\`\`

请按照系统提示词中的要求进行审查并返回 YAML 格式的结果。`;
  }

  /**
   * 调用 AI 服务
   */
  private async callAI(prompt: string): Promise<string> {
    const config = this.configService.ai;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
    }

    const response = await fetch(config.serviceUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: this.cachePrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw Object.assign(
        new Error(`AI service error: ${response.status} ${response.statusText}`),
        {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        },
      );
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.content || '';
  }

  /**
   * 解析 AI 响应
   */
  private parseAIResponse(response: string): AIReviewResult {
    try {
      // 尝试提取 YAML（可能被包裹在 markdown 代码块中）
      const yamlMatch = response.match(/```yaml\s*([\s\S]*?)\s*```/);
      const yamlStr = yamlMatch ? yamlMatch[1] : response;

      // 解析 YAML
      const parsed = yaml.load(yamlStr.trim()) as any;

      // 验证和规范化数据
      return {
        reviews: this.normalizeReviews(parsed?.reviews || []),
      };
    } catch (error) {
      this.logger.warn('AI 响应 YAML 解析失败，返回空结果', error);

      // 如果 AI 没有返回有效 YAML，返回空结果
      return {
        reviews: [],
      };
    }
  }

  /**
   * 规范化审查结果
   */
  private normalizeReviews(reviews: any[]): Review[] {
    if (!Array.isArray(reviews)) return [];

    return reviews
      .filter((review) => review && typeof review === 'object')
      .map((review) => ({
        newPath: String(review.newPath || '').trim(),
        oldPath: String(review.oldPath || '').trim(),
        type: (review.type === 'old' ? 'old' : 'new') as 'old' | 'new',
        startLine: Number(review.startLine) || 0,
        endLine: Number(review.endLine) || 0,
        issueHeader: String(review.issueHeader || '').trim(),
        issueContent: String(review.issueContent || '').trim(),
      }))
      .filter(
        (review) =>
          review.newPath &&
          review.issueHeader &&
          review.issueContent &&
          review.startLine > 0 &&
          review.endLine > 0,
      );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { GitLabMRDiff } from '../gitlab';
import type { AIReviewResult, FileReview } from './interfaces';
import { ConfigService } from '../config';

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(private readonly configService: ConfigService) {}

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
      // 检查是否需要分批处理
      const shouldBatch = this.shouldBatchProcess(diffResult);

      let result: AIReviewResult;
      if (shouldBatch) {
        this.logger.log('文件数量较多，使用分批审查');
        result = await this.batchReviewMergeRequest(diffResult);
      } else {
        result = await this.singleReviewMergeRequest(diffResult);
      }

      this.logger.log(
        `MR #${diffResult.iid} 审查完成，总体评分: ${result.score}`,
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
    return this.parseAIResponse(response, diffResult);
  }

  /**
   * 分批审查
   */
  private async batchReviewMergeRequest(
    diffResult: GitLabMRDiff,
  ): Promise<AIReviewResult> {
    const maxFiles = this.configService.review.maxFilesPerReview;
    const fileChanges = diffResult.changes || [];
    const batches = this.splitIntoBatches(fileChanges, maxFiles);

    this.logger.log(`分为 ${batches.length} 批进行审查`);

    const batchResults: AIReviewResult[] = [];

    // 串行处理各批次（避免并发过高）
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.log(`处理第 ${i + 1}/${batches.length} 批，共 ${batch.length} 个文件`);

      const batchDiff: GitLabMRDiff = {
        ...diffResult,
        changes: batch,
        code_files: batch.length,
        total_files: diffResult.total_files ?? fileChanges.length,
      };

      const result = await this.singleReviewMergeRequest(batchDiff);
      batchResults.push(result);
    }

    // 合并结果
    return this.mergeReviewResults(batchResults);
  }

  /**
   * 判断是否需要分批处理
   */
  private shouldBatchProcess(diffResult: GitLabMRDiff): boolean {
    const maxFiles = this.configService.review.maxFilesPerReview;
    return diffResult.changes.length > maxFiles;
  }

  /**
   * 将文件列表分批
   */
  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 合并多个审查结果
   */
  private mergeReviewResults(results: AIReviewResult[]): AIReviewResult {
    if (results.length === 0) {
      return {
        score: 0,
        summary: '无审查结果',
        fileReviews: [],
      };
    }

    if (results.length === 1) {
      return results[0];
    }

    // 计算平均分
    const avgScore =
      results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;

    // 合并文件审查结果
    const allFileReviews = results.flatMap((r) => r.fileReviews);

    // 合并总体评语
    const summaries = results.map((r) => r.summary).filter(Boolean);
    const mergedSummary = `综合审查结果：\n${summaries.join('\n\n')}`;

    return {
      score: Math.round(avgScore * 10) / 10,
      summary: mergedSummary,
      fileReviews: allFileReviews,
    };
  }

  /**
   * 构建审查提示词
   */
  private buildReviewPrompt(
    diffResult: GitLabMRDiff,
  ): string {
    const diffs = diffResult.changes
      .map((d) => {
        const diffContent = d.extendedDiff || d.diff;
        const diffLines = this.truncateDiff(diffContent);
        return `### 文件: ${d.new_path}
${d.new_file ? '(新文件)' : ''}${d.deleted_file ? '(已删除)' : ''}${d.renamed_file ? '(已重命名)' : ''}

\`\`\`diff
${diffLines}
\`\`\``;
      })
      .join('\n\n');

    const outputFormat = this.getOutputFormat();

    return `你是一个专业的代码审查助手。请审查以下 Merge Request 的代码变更。

## 代码变更

${diffs}

## 审查要求

请进行标准审查，关注以下方面：
1. 代码质量和规范性
   - 命名是否清晰
   - 代码风格是否一致
2. 潜在的 bug 和安全问题
   - 常见的安全漏洞
   - 明显的逻辑错误
3. 性能优化建议
   - 明显的性能问题
4. 可读性和可维护性
   - 代码是否易于理解
   - 是否有必要的注释

评分标准：
- 9-10分：优秀，无明显问题
- 7-8分：良好，有少量改进建议
- 5-6分：一般，有需要修复的问题
- 1-4分：较差，有严重问题

## 输出格式

${outputFormat}

请严格按照 JSON 格式返回审查结果，不要包含任何其他文本。`;
  }

  /**
   * 截断过长的 diff
   */
  private truncateDiff(diffContent: string): string {
    const maxLines = this.configService.review.maxDiffLinesPerFile;
    const lines = diffContent.split('\n');

    if (lines.length <= maxLines) {
      return diffContent;
    }

    const truncatedLines = lines.slice(0, maxLines);
    const remainingLines = lines.length - maxLines;

    return `${truncatedLines.join('\n')}\n\n... (省略 ${remainingLines} 行)`;
  }

  /**
   * 获取输出格式说明
   */
  private getOutputFormat(): string {
    return `请以 JSON 格式返回审查结果：
\`\`\`json
{
  "score": 1-10的评分（整数）,
  "summary": "总体评语（200字以内）",
  "fileReviews": [
    {
      "filePath": "文件路径",
      "comments": ["审查意见1", "审查意见2"],
      "severity": "low|medium|high"
    }
  ]
}
\`\`\`

注意：
- score 必须是 1-10 之间的整数
- summary 应该简洁明了，突出重点
- comments 应该具体、可操作
- severity 表示问题严重程度：low（建议）、medium（需要修复）、high（必须修复）`;
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
  private parseAIResponse(
    response: string,
    diffResult: GitLabMRDiff,
  ): AIReviewResult {
    try {
      // 尝试提取 JSON（可能被包裹在 markdown 代码块中）
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;

      // 解析 JSON
      const parsed = JSON.parse(jsonStr.trim());

      // 验证和规范化数据
      return {
        score: this.normalizeScore(parsed.score),
        summary: parsed.summary || '代码审查完成',
        fileReviews: this.normalizeFileReviews(parsed.fileReviews || []),
      };
    } catch (error) {
      this.logger.warn('AI 响应解析失败，使用默认结果', error);

      // 如果 AI 没有返回有效 JSON，返回默认结果
      return {
        score: 7,
        summary: this.extractSummaryFromText(response),
        fileReviews: diffResult.changes.map((d) => ({
          filePath: d.new_path,
          comments: ['AI 审查结果解析失败，请人工审查'],
          severity: 'low' as const,
        })),
      };
    }
  }

  /**
   * 规范化评分
   */
  private normalizeScore(score: any): number {
    const numScore = Number(score);
    if (isNaN(numScore)) return 7;
    return Math.max(1, Math.min(10, Math.round(numScore)));
  }

  /**
   * 规范化文件审查结果
   */
  private normalizeFileReviews(fileReviews: any[]): FileReview[] {
    if (!Array.isArray(fileReviews)) return [];

    return fileReviews
      .filter((review) => review && typeof review === 'object')
      .map((review) => ({
        filePath: String(review.filePath || ''),
        comments: Array.isArray(review.comments)
          ? review.comments.map(String).filter(Boolean)
          : [],
        severity: this.normalizeSeverity(review.severity),
      }))
      .filter((review) => review.filePath && review.comments.length > 0);
  }

  /**
   * 规范化严重程度
   */
  private normalizeSeverity(
    severity: any,
  ): 'low' | 'medium' | 'high' | undefined {
    if (severity === 'low' || severity === 'medium' || severity === 'high') {
      return severity;
    }
    return undefined;
  }

  /**
   * 从文本中提取摘要
   */
  private extractSummaryFromText(text: string): string {
    // 截取前 500 个字符作为摘要
    const summary = text.slice(0, 500).trim();
    return summary || 'AI 审查完成，但无法解析详细结果';
  }
}

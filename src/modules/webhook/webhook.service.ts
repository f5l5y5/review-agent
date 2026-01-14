import { Injectable, Logger } from '@nestjs/common';
import type { GitLabMREvent, WebhookProcessResult } from './interfaces';
import type { GitLabMRDiff } from '../gitlab';
import { GitlabService } from '../gitlab';
import { AiReviewService, AIReviewResult } from '../ai-review';
import { NotificationService } from '../notification';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly gitlabService: GitlabService,
    private readonly aiReviewService: AiReviewService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 处理 GitLab Merge Request 事件
   */
  async handleMergeRequestEvent(
    event: GitLabMREvent,
    pushUrl?: string,
    gitlabInstance?: string,
    gitlabToken?: string,
  ): Promise<WebhookProcessResult> {
    const mr = event.object_attributes;

    this.logger.log('=== Merge Request Details ===');
    this.logger.log(`MR ID: ${mr?.id}`);
    this.logger.log(`MR IID: ${mr?.iid}`);
    this.logger.log(`Title: ${mr?.title}`);
    this.logger.log(`Author: ${event.user?.name}`);
    this.logger.log(`Project: ${event.project?.name}`);
    this.logger.log(`Push URL: ${pushUrl || 'Not provided'}`);
    this.logger.log(`GitLab Instance: ${gitlabInstance || 'Not provided'}`);

    // 处理 MR 业务逻辑
    await this.processMergeRequest(event, pushUrl, gitlabInstance, gitlabToken);

    return {
      success: true,
      message: 'Merge request event processed',
      data: {
        mr_id: mr?.id,
        mr_iid: mr?.iid,
        action: mr?.action,
        title: mr?.title,
      },
    };
  }

  /**
   * 处理 Merge Request 的具体业务逻辑
   */
  private async processMergeRequest(
    event: GitLabMREvent,
    pushUrl?: string,
    gitlabInstance?: string,
    accessToken?: string,
  ): Promise<{ diffResult: GitLabMRDiff; reviewResult: AIReviewResult }> {
    try {
      // 1. 获取 MR 的 diff 内容（已过滤非代码文件）
      const diffResult = await this.gitlabService.getMergeRequestDiffFiltered(event, gitlabInstance, accessToken);

      this.logger.log('=== MR Diff Summary ===');
      this.logger.log(`Project ID: ${diffResult.project_id}`);
      this.logger.log(`MR IID: ${diffResult.iid}`);
      this.logger.log(`Title: ${diffResult.title}`);
      this.logger.log(`Total Changes: ${diffResult.changes_count}`);
      this.logger.log(`Code Files (filtered): ${diffResult.changes.length}`);

      // 2. 调用 AI 进行代码审查
      const reviewResult = await this.aiReviewService.reviewMergeRequest(diffResult);

      this.logger.log('=== AI Review Result ===');
      this.logger.log(`Score: ${reviewResult.score}`);
      this.logger.log(`Summary: ${reviewResult.summary}`);

      // 3. 添加gitlab MR代码评论

      // 3. 发送审查结果通知
      await this.notificationService.sendReviewNotification(
        {
          event,
          diffResult,
          reviewResult,
        },
        pushUrl,
      );

      return { diffResult, reviewResult };
    } catch (error) {
      // 发生错误时发送失败通知
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('代码审查失败，发送失败通知', error);

      await this.notificationService.sendFailureNotification(
        {
          event,
          error: errorMessage,
        },
        pushUrl,
      );

      throw error;
    }
  }
}

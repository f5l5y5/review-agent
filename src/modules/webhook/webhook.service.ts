import { Injectable } from '@nestjs/common';
import {
  GitLabWebhookHeaders,
  GitLabMREvent,
  WebhookProcessResult,
} from './interfaces';

@Injectable()
export class WebhookService {
  /**
   * 处理 GitLab Merge Request 事件
   */
  async handleMergeRequestEvent(event: GitLabMREvent): Promise<WebhookProcessResult> {
    const mr = event.object_attributes;

    console.log('=== Merge Request Details ===');
    console.log('MR ID:', mr?.id);
    console.log('MR IID:', mr?.iid);
    console.log('Title:', mr?.title);
    console.log('State:', mr?.state);
    console.log('Action:', mr?.action);
    console.log('Source Branch:', mr?.source_branch);
    console.log('Target Branch:', mr?.target_branch);
    console.log('Author:', event.user?.name);
    console.log('Project:', event.project?.name);

    // TODO: 在这里添加具体的业务逻辑处理
    // 例如：代码审查、通知发送、自动化测试等
    await this.processMergeRequest(mr, event);

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
   * 处理其他类型的 GitLab 事件
   */
  async handleGenericEvent(
    eventType: string,
    event: GitLabMREvent,
  ): Promise<WebhookProcessResult> {
    console.log('=== Generic Event Details ===');
    console.log('Event Type:', eventType);
    console.log('Object Kind:', event.object_kind);
    console.log('Event Details:', JSON.stringify(event, null, 2));

    return {
      success: true,
      message: 'Webhook event received',
      event_type: event.object_kind,
    };
  }

  /**
   * 处理 Merge Request 的具体业务逻辑
   */
  private async processMergeRequest(
    mr: GitLabMREvent['object_attributes'],
    event: GitLabMREvent,
  ) {
    // 这里可以添加：
    // 1. 调用代码审查 API
    // 2. 发送通知到钉钉/企业微信/Slack
    // 3. 触发 CI/CD 流程
    // 4. 更新数据库记录
    // 5. 调用 GitLab API 添加评论等

    console.log('Processing merge request business logic...');
  }

  /**
   * 验证 Webhook Token
   */
  validateToken(token: string | undefined, expectedToken: string): boolean {
    if (!expectedToken) return true; // 如果没有配置 token，则不验证
    return token === expectedToken;
  }

  /**
   * 获取事件类型
   */
  getEventType(headers: GitLabWebhookHeaders): string {
    return headers['x-gitlab-event'] || 'unknown';
  }
}

import { Controller, Post, Headers, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import type { GitLabWebhookHeaders, GitLabMREvent } from './interfaces';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async handleTrigger(
    @Headers() headers: GitLabWebhookHeaders,
    @Body() event: GitLabMREvent,
  ) {
    // 验证 body 是否存在
    if (!event) {
      throw new BadRequestException('Request body is required');
    }

    const eventType = this.webhookService.getEventType(headers);
    const token = headers['x-gitlab-token'];

    console.log('=== Webhook Event Received ===');
    console.log('Event Type:', eventType);
    console.log('Token:', token ? 'Provided' : 'Not provided');
    console.log('Object Kind:', event?.object_kind);

    // 验证是否为 MR 事件
    if (event?.object_kind === 'merge_request' || eventType === 'Merge Request Hook') {
      return this.webhookService.handleMergeRequestEvent(event);
    }

    // 处理其他类型的 GitLab 事件
    return this.webhookService.handleGenericEvent(eventType, event);
  }
}

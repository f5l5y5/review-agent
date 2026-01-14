import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookGuard } from './webhook.guard';
import { NotificationService } from '../notification';
import type { GitLabWebhookHeaders, GitLabMREvent } from './interfaces';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookGuard)
  async handleTrigger(
    @Headers() headers: GitLabWebhookHeaders,
    @Body() event: GitLabMREvent,
  ) {
    const pushUrl = headers['x-push-url'];

    try {
      const eventType = headers['x-gitlab-event'];
      const gitlabInstance = headers['x-gitlab-instance'];
      const accessToken = headers['x-access-token'];

      this.logger.log('=== Webhook Event Received ===');
      this.logger.log(`Event Type: ${eventType}`);
      this.logger.log(`Object Kind: ${event?.object_kind}`);
      this.logger.log(`GitLab Instance: ${gitlabInstance || 'Not provided'}`);
      this.logger.log(`Has Access Token: ${!!accessToken}`);

      // 只处理 MR 事件
      if (event?.object_kind !== 'merge_request' && eventType !== 'Merge Request Hook') {
        throw new BadRequestException('Only Merge Request events are supported');
      }

      return await this.webhookService.handleMergeRequestEvent(event, {
        pushUrl,
        gitlabInstance,
        accessToken,
      });
    } catch (error) {
      // 捕获所有错误并发送钉钉通知
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorContext = event?.object_attributes?.iid
        ? `MR #${event.object_attributes.iid} 处理失败`
        : 'Webhook 请求处理失败';

      this.logger.error(`${errorContext}: ${errorMessage}`, error);

      // 尝试发送钉钉通知（不阻塞错误响应）
      if (pushUrl) {
        try {
          if (event?.object_attributes) {
            // 如果有完整的事件信息，使用失败通知
            await this.notificationService.sendFailureNotification(
              { event, error: errorMessage },
              pushUrl,
            );
          } else {
            // 否则使用通用错误通知
            await this.notificationService.sendGenericErrorNotification(
              errorMessage,
              errorContext,
              pushUrl,
            );
          }
        } catch (notificationError) {
          this.logger.error('发送错误通知失败', notificationError);
        }
      }

      // 重新抛出原始错误
      throw error;
    }
  }
}

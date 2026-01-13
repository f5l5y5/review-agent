import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { GitlabService } from './gitlab.service';
import { AiReviewService } from './ai-review.service';
import { NotificationService } from './notification.service';
import { ConfigService } from './config.service';
import { WebhookGuard } from './webhook.guard';

@Module({
  controllers: [WebhookController],
  providers: [
    WebhookService,
    GitlabService,
    AiReviewService,
    NotificationService,
    ConfigService,
    WebhookGuard,
  ],
  exports: [WebhookService, ConfigService],
})
export class WebhookModule {}

import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { GitlabService } from '../gitlab';
import { AiReviewService } from '../ai-review';
import { NotificationService } from '../notification';
import { ConfigService } from '../config';
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

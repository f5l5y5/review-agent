import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { NotificationService } from './notification.service';

/**
 * Webhook Token 验证守卫
 * 验证 GitLab Webhook 请求的 Token
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-gitlab-token'];
    const expectedToken = this.configService.gitlab.webhookToken;
    const pushUrl = request.headers['x-push-url'];

    // 验证 webhook token 是否已配置
    if (!expectedToken) {
      const errorMsg = 'Webhook token 未配置，请在环境变量中设置 GITLAB_WEBHOOK_TOKEN';
      this.logger.error(errorMsg);

      // 发送钉钉通知
      this.sendErrorNotification(errorMsg, 'Token 配置错误', pushUrl);

      throw new UnauthorizedException(errorMsg);
    }

    // 验证 token
    if (!token) {
      const errorMsg = '请求缺少 x-gitlab-token 头';
      this.logger.error(errorMsg);

      // 发送钉钉通知
      this.sendErrorNotification(errorMsg, 'Token 验证失败', pushUrl);

      throw new UnauthorizedException('Missing webhook token');
    }

    if (token !== expectedToken) {
      const errorMsg = 'Webhook token 验证失败';
      this.logger.error(errorMsg);

      // 发送钉钉通知
      this.sendErrorNotification(errorMsg, 'Token 验证失败', pushUrl);

      throw new UnauthorizedException('Invalid webhook token');
    }

    this.logger.log('Webhook token 验证通过');
    return true;
  }

  /**
   * 发送错误通知到钉钉（异步，不阻塞请求）
   */
  private sendErrorNotification(error: string, context: string, pushUrl?: string): void {
    if (pushUrl) {
      // 异步发送，不等待结果
      this.notificationService
        .sendGenericErrorNotification(error, context, pushUrl)
        .catch((err) => {
          this.logger.error('发送钉钉错误通知失败', err);
        });
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { NotificationContent, FailureNotificationContent } from './interfaces';

/**
 * 钉钉消息格式
 */
interface DingTalkMessage {
  msgtype: 'text' | 'markdown';
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
}

/**
 * 通知服务
 * 统一管理各种通知渠道
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor() {}

  /**
   * 发送审查通知
   */
  async sendReviewNotification(
    content: NotificationContent,
    pushUrl?: string,
  ): Promise<void> {
    const { event, diffResult, reviewResult } = content;

    this.logger.log(
      `发送审查通知: MR #${diffResult.iid}, 发现 ${reviewResult.reviews.length} 个问题`,
    );

    // 发送钉钉通知
    if (pushUrl) {
      await this.sendDingTalkNotification(content, pushUrl);
    } else {
      this.logger.warn('钉钉 Webhook URL 未提供，跳过钉钉通知');
    }
  }

  /**
   * 发送失败通知
   */
  async sendFailureNotification(
    content: FailureNotificationContent,
    pushUrl?: string,
  ): Promise<void> {
    const { event, error } = content;

    this.logger.error(`发送失败通知: MR #${event.object_attributes?.iid}, 错误: ${error}`);

    // 发送钉钉失败通知
    if (pushUrl) {
      await this.sendDingTalkFailureNotification(content, pushUrl);
    } else {
      this.logger.warn('钉钉 Webhook URL 未提供，跳过钉钉通知');
    }
  }

  /**
   * 发送通用错误通知（用于无法获取完整事件信息的错误）
   */
  async sendGenericErrorNotification(
    error: string,
    context: string,
    pushUrl?: string,
  ): Promise<void> {
    this.logger.error(`发送通用错误通知: ${context}, 错误: ${error}`);

    if (pushUrl) {
      await this.sendDingTalkGenericError(error, context, pushUrl);
    } else {
      this.logger.warn('钉钉 Webhook URL 未提供，跳过钉钉通知');
    }
  }

  /**
   * 发送钉钉通知
   */
  private async sendDingTalkNotification(
    content: NotificationContent,
    pushUrl: string,
  ): Promise<void> {
    const message = this.formatDingTalkMessage(content);

    try {
      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(
          `钉钉 API 错误: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      if (result.errcode !== 0) {
        throw new Error(`钉钉 API 返回错误: ${result.errmsg}`);
      }

      this.logger.log('钉钉通知发送成功');
    } catch (error) {
      this.logger.error('钉钉通知发送失败', error);
      throw error;
    }
  }

  /**
   * 发送钉钉失败通知
   */
  private async sendDingTalkFailureNotification(
    content: FailureNotificationContent,
    pushUrl: string,
  ): Promise<void> {
    const message = this.formatDingTalkFailureMessage(content);

    try {
      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(
          `钉钉 API 错误: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      if (result.errcode !== 0) {
        throw new Error(`钉钉 API 返回错误: ${result.errmsg}`);
      }

      this.logger.log('钉钉失败通知发送成功');
    } catch (error) {
      this.logger.error('钉钉失败通知发送失败', error);
      throw error;
    }
  }

  /**
   * 发送钉钉通用错误通知
   */
  private async sendDingTalkGenericError(
    error: string,
    context: string,
    pushUrl: string,
  ): Promise<void> {
    const message = this.formatDingTalkGenericErrorMessage(error, context);

    try {
      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(
          `钉钉 API 错误: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      if (result.errcode !== 0) {
        throw new Error(`钉钉 API 返回错误: ${result.errmsg}`);
      }

      this.logger.log('钉钉通用错误通知发送成功');
    } catch (error) {
      this.logger.error('钉钉通用错误通知发送失败', error);
      // 不再抛出错误，避免无限循环
    }
  }

  /**
   * 格式化钉钉消息（Markdown 格式）
   */
  private formatDingTalkMessage(
    content: NotificationContent,
  ): DingTalkMessage {
    const { event, diffResult, reviewResult } = content;

    const mrUrl = event.object_attributes?.url || '';
    const projectName = event.project?.name || '未知项目';
    const mrTitle = event.object_attributes?.title || '未知 MR';
    const author = event.user?.name || '未知作者';
    const mrIid = event.object_attributes?.iid || '?';
    const codeFiles = diffResult.code_files ?? diffResult.changes?.length ?? 0;
    const totalFiles =
      diffResult.total_files ??
      (typeof diffResult.changes_count === 'string'
        ? Number(diffResult.changes_count)
        : undefined) ??
      diffResult.changes?.length ??
      codeFiles;

    // 代码审查通知标题
    let text = `## 📋 代码审查通知 - [MR #${mrIid}] ${mrTitle}\n\n`;
    text += `---\n\n`;

    const reviewCount = reviewResult.reviews.length;
    const statusEmoji = reviewCount === 0 ? '✅' : reviewCount <= 3 ? '⚠️' : '❌';

    text += `# ${statusEmoji} 代码审查报告\n\n`;
    text += `**审查结果**: 发现 ${reviewCount} 个问题\n\n`;

    if (reviewResult.reviews.length > 0) {
      text += `### 详细意见\n\n`;
      reviewResult.reviews.forEach((review) => {
        const emoji = this.getIssueEmoji(review.issueHeader);
        text += `${emoji} **${review.newPath}** (${review.type === 'new' ? '新代码' : '旧代码'} 第 ${review.startLine}-${review.endLine} 行)\n\n`;
        text += `**${review.issueHeader}**\n\n`;
        text += `${review.issueContent}\n\n`;
        text += `---\n\n`;
      });
    } else {
      text += `### ✅ 未发现明显问题\n\n`;
      text += `代码审查未发现需要特别注意的问题。\n\n`;
      text += `---\n\n`;
    }

    text += `**项目**: ${projectName}\n\n`;
    text += `**MR**: [${mrTitle}](${mrUrl})\n\n`;
    text += `**作者**: ${author}\n\n`;
    text += `**文件数**: ${codeFiles} 个代码文件（总计 ${totalFiles} 个文件）\n\n`;

    return {
      msgtype: 'markdown',
      markdown: {
        title: `代码审查: ${mrTitle}`,
        text,
      },
    };
  }

  /**
   * 格式化钉钉失败消息（Markdown 格式）
   */
  private formatDingTalkFailureMessage(
    content: FailureNotificationContent,
  ): DingTalkMessage {
    const { event, error } = content;

    const mrUrl = event.object_attributes?.url || '';
    const projectName = event.project?.name || '未知项目';
    const mrTitle = event.object_attributes?.title || '未知 MR';
    const author = event.user?.name || '未知作者';
    const mrIid = event.object_attributes?.iid || '未知';

    let text = `# 代码审查失败\n\n`;
    text += `**项目**: ${projectName}\n\n`;
    text += `**MR**: [${mrTitle}](${mrUrl})\n\n`;
    text += `**MR IID**: #${mrIid}\n\n`;
    text += `**作者**: ${author}\n\n`;
    text += `---\n\n`;
    text += `### 错误信息\n\n`;
    text += `\`\`\`\n${error}\n\`\`\`\n\n`;

    return {
      msgtype: 'markdown',
      markdown: {
        title: `代码审查失败: ${mrTitle}`,
        text,
      },
    };
  }

  /**
   * 格式化钉钉通用错误消息（Markdown 格式）
   */
  private formatDingTalkGenericErrorMessage(
    error: string,
    context: string,
  ): DingTalkMessage {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });

    let text = `# ⚠️ 代码审查 Webhook 处理错误\n\n`;
    text += `**时间**: ${timestamp}\n\n`;
    text += `**上下文**: ${context}\n\n`;
    text += `---\n\n`;
    text += `### 错误信息\n\n`;
    text += `\`\`\`\n${error}\n\`\`\`\n\n`;

    return {
      msgtype: 'markdown',
      markdown: {
        title: `代码审查 Webhook 处理错误: ${context}`,
        text,
      },
    };
  }

  /**
   * 获取问题类型对应的 emoji
   */
  private getIssueEmoji(issueHeader: string): string {
    const header = issueHeader.toLowerCase();
    if (header.includes('错误') || header.includes('bug')) return '🔴';
    if (header.includes('安全') || header.includes('风险')) return '⚠️';
    if (header.includes('性能')) return '⚡';
    if (header.includes('建议') || header.includes('优化')) return '💡';
    if (header.includes('规范') || header.includes('风格')) return '📝';
    return '🔵';
  }
}

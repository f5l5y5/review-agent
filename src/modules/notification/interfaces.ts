import type { AIReviewResult } from '../ai-review';
import type { GitLabMREvent } from '../webhook';
import type { GitLabMRDiff } from '../gitlab';

/**
 * 通知内容
 */
export interface NotificationContent {
  event: GitLabMREvent;
  diffResult: GitLabMRDiff;
  reviewResult: AIReviewResult;
}

/**
 * 失败通知内容
 */
export interface FailureNotificationContent {
  event: GitLabMREvent;
  error: string;
}

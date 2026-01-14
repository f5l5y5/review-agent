/**
 * GitLab Webhook 请求头类型
 */
export interface GitLabWebhookHeaders {
  'x-gitlab-event': string;
  'x-gitlab-token'?: string;
  'x-gitlab-instance'?: string;
  'x-ai-mode'?: string;
  'x-push-url'?: string;
}

/**
 * GitLab 用户信息
 */
export interface GitLabUser {
  id: number;
  name: string;
  email: string;
  username: string;
}

/**
 * GitLab 项目信息
 */
export interface GitLabProject {
  id: number;
  name: string;
  web_url: string;
}

/**
 * Merge Request 属性
 */
export interface MergeRequestAttributes {
  id: number;
  iid: number;
  title: string;
  description?: string;
  state?: string;
  url: string;
  action?: string;
}

/**
 * GitLab Merge Request 事件
 */
export interface GitLabMREvent {
  object_kind: string;
  event_type?: string;
  user?: GitLabUser;
  project?: GitLabProject;
  object_attributes?: MergeRequestAttributes;
}

/**
 * Webhook 处理结果
 */
export interface WebhookProcessResult {
  success: boolean;
  message: string;
  event_type?: string;
  data?: any;
}

/**
 * 处理 Merge Request 的配置选项
 */
export interface HandleMergeRequestOptions {
  event: GitLabMREvent;
  pushUrl?: string;
  gitlabInstance?: string;
  accessToken?: string;
}

/**
 * 处理 Merge Request 的额外配置选项（不包含 event）
 */
export interface MergeRequestEventOptions {
  pushUrl?: string;
  gitlabInstance?: string;
  accessToken?: string;
}

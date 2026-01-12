/**
 * GitLab Webhook 请求头类型
 */
export interface GitLabWebhookHeaders {
  'x-gitlab-event': string;
  'x-gitlab-token'?: string;
  'x-gitlab-instance'?: string;
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
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  merge_status: string;
  source_branch: string;
  target_branch: string;
  author_id: number;
  assignee_id: number;
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

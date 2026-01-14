/**
 * GitLab MR 单个文件的 Diff
 */
export interface GitLabMRDiffFile {
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  /** 带行号标注的扩展 diff 内容 */
  extendedDiff?: string;
  /** 新文件行号与内容的映射 */
  newLinesWithNumber?: Map<number, string>;
  /** 旧文件行号与内容的映射 */
  oldLinesWithNumber?: Map<number, string>;
}

/**
 * GitLab 用户信息（简化版）
 */
export interface GitLabAuthor {
  id: number;
  username: string;
  name: string;
  email: string;
}

/**
 * GitLab MR Diff 结果（完整信息）
 */
export interface GitLabMRDiff {
  // MR 基本信息
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  target_branch: string;
  source_branch: string;
  author: GitLabAuthor;
  web_url: string;

  // Diff 相关
  changes_count: string;
  changes: GitLabMRDiffFile[];
  diff_refs: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
  };
  /** 带行号标注的完整 diff 文本 */
  extendedContent?: string;
  /** 过滤后的代码文件数量 */
  code_files?: number;
  /** MR 中的总文件数 */
  total_files?: number;
}

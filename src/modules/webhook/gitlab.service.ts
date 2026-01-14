import { Injectable, Logger } from '@nestjs/common';
import type { GitLabMREvent, GitLabMRDiff, GitLabMRDiffFile } from './interfaces';
import { ConfigService } from './config.service';

/**
 * 代码文件扩展名白名单
 */
const CODE_FILE_EXTENSIONS = [
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyw', '.pyi',
  // Java
  '.java', '.kt', '.kts', '.scala', '.groovy',
  // C/C++
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
  // C#
  '.cs', '.vb',
  // Go
  '.go',
  // Rust
  '.rs',
  // Ruby
  '.rb',
  // PHP
  '.php',
  // Swift
  '.swift',
  // Shell
  '.sh', '.bash', '.zsh',
  // Config
  '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
  // Web
  '.html', '.css', '.scss', '.sass', '.less',
  // Other
  '.sql', '.r', '.dart', '.lua', '.pl', '.pm',
];

/**
 * 非代码文件路径模式
 */
const NON_CODE_PATTERNS = [
  /node_modules/,
  /\/dist\//,
  /\/build\//,
  /\/\.git\//,
  /\/\.vscode\//,
  /\/\.idea\//,
  /\.min\.js$/,
  /\.lock$/,
  /\.map$/,
];

@Injectable()
export class GitlabService {
  private readonly logger = new Logger(GitlabService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * 获取 MR 的所有 diff 内容
   */
  async getMergeRequestDiff(
    projectId: number,
    mergeRequestIid: number,
    gitlabInstance?: string,
    gitlabToken?: string,
  ): Promise<GitLabMRDiffFile[]> {
    const config = this.configService.gitlab;
    // 使用传入的 gitlabInstance 或配置中的 apiUrl，并加上 /api/v4
    const baseUrl = (gitlabInstance || this.configService.gitlab.baseUrl || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('GitLab base URL is not configured. Set GITLAB_BASE_URL or provide x-gitlab-instance header.');
    }

    const url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/changes`
    // const url = `${baseUrl}/projects/${projectId}/merge_requests/${mergeRequestIid}/diffs`;

    this.logger.log(`获取 MR diff: project=${projectId}, iid=${mergeRequestIid}, url=${url}`);

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(gitlabToken),
      });

      if (!response.ok) {
        throw Object.assign(
          new Error(`GitLab API error: ${response.status} ${response.statusText}`),
          {
            status: response.status,
            statusText: response.statusText,
          },
        );
      }

      const data = await response.json();

      this.logger.log(`成功获取 MR diff，共 ${data.changes.length} 个文件`);
      return data.changes;
    } catch (error) {
      this.logger.error('获取 MR diff 失败', error);
      throw error;
    }
  }

  /**
   * 获取 MR 的完整 diff 内容（带过滤）
   */
  async getMergeRequestDiffFiltered(
    event: GitLabMREvent,
    gitlabInstance?: string,
    gitlabToken?: string,
  ): Promise<GitLabMRDiff> {
    const projectId = event.project?.id;
    const mrIid = event.object_attributes?.iid;

    if (!projectId || !mrIid) {
      throw new Error('Invalid MR event: missing project ID or MR IID');
    }

    // 获取所有 diff 文件
    const allDiffs = await this.getMergeRequestDiff(projectId, mrIid, gitlabInstance, gitlabToken);

    // 过滤出代码文件
    const codeDiffs = allDiffs.filter(diff =>
      this.isCodeFile(diff.new_path) || this.isCodeFile(diff.old_path),
    );

    return {
      project_id: projectId,
      mr_iid: mrIid,
      total_files: allDiffs.length,
      code_files: codeDiffs.length,
      diffs: codeDiffs,
    };
  }

  /**
   * 判断文件是否为代码文件
   */
  private isCodeFile(filePath: string): boolean {
    if (!filePath) return false;

    // 检查是否匹配非代码文件模式
    for (const pattern of NON_CODE_PATTERNS) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    // 检查扩展名是否在白名单中
    const ext = this.getFileExtension(filePath);
    return CODE_FILE_EXTENSIONS.includes(ext);
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filePath.slice(lastDotIndex).toLowerCase();
  }

  /**
   * 获取请求头
   * @param accessToken - 用于调用 GitLab API 的 Personal Access Token
   */
  private getHeaders(accessToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 优先使用传入的 access token，如果没有则使用配置中的默认 token
    const apiToken = accessToken || this.configService.gitlab.token;
    if (apiToken) {
      headers['PRIVATE-TOKEN'] = apiToken;
    }

    return headers;
  }

  /**
   * 获取 MR 的原始内容（单个文件）
   */
  async getMergeRequestDiffRaw(
    projectId: number,
    mergeRequestIid: number,
    gitlabInstance?: string,
    gitlabToken?: string,
  ): Promise<GitLabMRDiffFile[]> {
    return this.getMergeRequestDiff(projectId, mergeRequestIid, gitlabInstance, gitlabToken);
  }
}

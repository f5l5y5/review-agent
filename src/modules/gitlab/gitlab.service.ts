import { Injectable, Logger } from '@nestjs/common';
import type { GitLabMREvent } from '../webhook';
import type { GitLabMRDiff, GitLabMRDiffFile } from './interfaces';
import { ConfigService } from '../config';

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

interface Hunk {
  oldStart: number;
  newStart: number;
  hunkLines: string[];
}

@Injectable()
export class GitlabService {
  private readonly logger = new Logger(GitlabService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取 MR 的所有内容
   */
  async getMergeRequestDiff(
    projectId: number,
    mergeRequestIid: number,
    gitlabInstance?: string,
    gitlabToken?: string,
  ): Promise<GitLabMRDiff> {
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

      this.logger.log(`成功获取 MR diff: ${data.title}，共 ${data.changes.length} 个文件`);

      // 返回完整的 MR 信息
      return data;
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

    // 获取所有 event 文件
    const mrEvent = await this.getMergeRequestDiff(projectId, mrIid, gitlabInstance, gitlabToken);

    // 过滤出代码文件
    const allChanges = mrEvent.changes || [];
    const codeDiffs = allChanges.filter(diff =>
      this.isCodeFile(diff.new_path) || this.isCodeFile(diff.old_path),
    );

    const codeDiffsWithLineNumbers = this.addLineNumbers(codeDiffs);
    const extendedContent = this.buildExtendedDiffContent(
      mrEvent.title,
      codeDiffsWithLineNumbers,
    );

    // 返回完整的 MR 信息，但只包含代码文件的 diff
    return {
      ...mrEvent,
      changes: codeDiffsWithLineNumbers,
      code_files: codeDiffsWithLineNumbers.length,
      total_files: allChanges.length,
      extendedContent,
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
   * 为 diff 文件添加行号标注
   */
  private addLineNumbers(diffFiles: GitLabMRDiffFile[]): GitLabMRDiffFile[] {
    return diffFiles.map((diffFile) => {
      const hunks = this.splitHunk(diffFile.diff);
      const oldLinesWithNumber: Map<number, string> = new Map();
      const newLinesWithNumber: Map<number, string> = new Map();
      const newDiffParts: string[] = [];

      hunks.forEach((hunk) => {
        const { formattedHunk, newLines, oldLines } = this.computeHunkWithLineNumbers(hunk);
        newDiffParts.push(formattedHunk.join('\n'));

        newLines.forEach((line, lineNumber) => {
          newLinesWithNumber.set(lineNumber, line);
        });
        oldLines.forEach((line, lineNumber) => {
          oldLinesWithNumber.set(lineNumber, line);
        });
      });

      return {
        ...diffFile,
        extendedDiff: newDiffParts.join('\n'),
        newLinesWithNumber,
        oldLinesWithNumber,
      };
    });
  }

  /**
   * 将 diff 字符串拆分成多个 hunk
   */
  private splitHunk(diff: string): Hunk[] {
    const lines = diff.split('\n');
    const hunks: Hunk[] = [];

    let currentHunk: Hunk = {
      oldStart: 0,
      newStart: 0,
      hunkLines: [],
    };

    lines.forEach((line) => {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);

        if (currentHunk.hunkLines.length) {
          hunks.push(currentHunk);
          currentHunk = {
            oldStart: 0,
            newStart: 0,
            hunkLines: [],
          };
        }

        if (match) {
          currentHunk.oldStart = parseInt(match[1], 10);
          currentHunk.newStart = parseInt(match[3], 10);
        }
      }

      currentHunk.hunkLines.push(line);
    });

    if (currentHunk.hunkLines.length) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * 为 hunk 中的每一行计算并添加行号标注
   */
  private computeHunkWithLineNumbers(hunk: Hunk) {
    const { oldStart, newStart } = hunk;
    const temp: Array<[string, string]> = [];
    const formattedHunk: string[] = [hunk.hunkLines[0]];
    let maxHeadLength = 0;
    const oldLines: Map<number, string> = new Map();
    const newLines: Map<number, string> = new Map();

    let oldLineNumber = oldStart;
    let newLineNumber = newStart;

    hunk.hunkLines.slice(1).forEach((line) => {
      let head = '';
      if (line.startsWith('-')) {
        head = `(${oldLineNumber}, )`;
        temp.push([head, line]);
        oldLines.set(oldLineNumber, line);
        oldLineNumber++;
      } else if (line.startsWith('+')) {
        head = `( , ${newLineNumber})`;
        temp.push([head, line]);
        newLines.set(newLineNumber, line);
        newLineNumber++;
      } else {
        head = `(${oldLineNumber}, ${newLineNumber})`;
        temp.push([head, line]);
        oldLines.set(oldLineNumber, line);
        newLines.set(newLineNumber, line);
        oldLineNumber++;
        newLineNumber++;
      }

      maxHeadLength = Math.max(maxHeadLength, head.length);
    });

    temp.forEach(([head, line]) => {
      formattedHunk.push(`${head.padEnd(maxHeadLength)} ${line}`);
    });

    return { formattedHunk, newLines, oldLines };
  }

  /**
   * 获取扩展的 diff 内容
   *
   * 生成包含 commit message 和带行号标注的 diff 文件内容的完整字符串，
   * 用于发送给 AI 进行代码审查。
   */
  private buildExtendedDiffContent(
    commitMessage: string | undefined,
    diffFiles: GitLabMRDiffFile[],
  ): string {
    const header = `commit message: ${commitMessage || ''}\n\n`;

    const body = diffFiles.reduce((pre, cur) => {
      const diffContent = cur.extendedDiff || cur.diff;
      return `${pre}## new_path: ${cur.new_path}\n## old_path: ${cur.old_path}\n${diffContent}\n\n`;
    }, '');

    return header + body;
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

  

}

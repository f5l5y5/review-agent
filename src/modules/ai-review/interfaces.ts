/**
 * 单个代码审查项
 */
export interface Review {
  /** 修改后的文件路径 */
  newPath: string;
  /** 修改前的文件路径 */
  oldPath: string;
  /**
   * 评审的是旧代码还是新代码
   * - 'new': 评审 + 部分的新代码
   * - 'old': 评审 - 部分的旧代码
   */
  type: 'old' | 'new';
  /**
   * 起始行号
   * - type='old' 时表示旧代码的行号
   * - type='new' 时表示新代码的行号
   */
  startLine: number;
  /**
   * 结束行号
   * - type='old' 时表示旧代码的行号
   * - type='new' 时表示新代码的行号
   */
  endLine: number;
  /**
   * 问题标题（如：逻辑错误、语法错误、安全风险等）
   * 尽可能不超过 6 个字
   */
  issueHeader: string;
  /** 清晰描述代码问题并给出明确建议 */
  issueContent: string;
}

/**
 * MR 代码审查结果
 */
export interface MRReview {
  reviews: Review[];
}

/**
 * AI 审查结果
 */
export interface AIReviewResult {
  /** 总体评分 */
  score?: number;
  /** 总体评语 */
  summary: string;
  /** 各文件审查结果 */
  fileReviews: FileReview[];
}

/**
 * 单文件审查结果
 */
export interface FileReview {
  /** 文件路径 */
  filePath: string;
  /** 审查意见 */
  comments: string[];
  /** 严重程度 */
  severity?: 'low' | 'medium' | 'high';
}

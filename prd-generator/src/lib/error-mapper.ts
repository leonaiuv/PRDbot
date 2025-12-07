/**
 * 错误处理映射模块
 * - 将HTTP状态码映射为用户友好的错误提示
 * - 提供结构化错误响应
 * - 支持详细错误信息和解决建议
 */

export interface ErrorResponse {
  /** 用户友好的错误描述 */
  error: string;
  /** 详细错误信息 */
  detail?: string;
  /** 错误代码 (便于日志追踪) */
  code?: string;
  /** 解决建议 */
  suggestion?: string;
}

/**
 * HTTP状态码到友好错误的映射表
 */
const ERROR_MESSAGES: Record<number, { message: string; code: string; suggestion: string }> = {
  400: {
    message: '请求参数有误',
    code: 'BAD_REQUEST',
    suggestion: '请检查输入内容格式',
  },
  401: {
    message: 'API Key无效或已过期',
    code: 'AUTH_INVALID_KEY',
    suggestion: '请在设置页面重新配置API Key',
  },
  402: {
    message: '账户余额不足',
    code: 'PAYMENT_REQUIRED',
    suggestion: '请充值后继续使用',
  },
  403: {
    message: '账号无权访问该模型',
    code: 'FORBIDDEN',
    suggestion: '请确认账号权限或更换模型',
  },
  404: {
    message: '模型不可用',
    code: 'MODEL_NOT_FOUND',
    suggestion: '请检查模型配置是否正确',
  },
  429: {
    message: '请求过于频繁',
    code: 'RATE_LIMITED',
    suggestion: '请等待60秒后重试',
  },
  500: {
    message: 'AI服务暂时不可用',
    code: 'SERVER_ERROR',
    suggestion: '请稍后重试',
  },
  502: {
    message: '服务连接超时',
    code: 'BAD_GATEWAY',
    suggestion: '请检查网络连接后重试',
  },
  503: {
    message: '服务暂时不可用',
    code: 'SERVICE_UNAVAILABLE',
    suggestion: '请稍后重试',
  },
  504: {
    message: '网关超时',
    code: 'GATEWAY_TIMEOUT',
    suggestion: '请检查网络连接后重试',
  },
};

/**
 * 从上游API响应中提取详细错误信息
 * @param errorText 上游返回的错误文本
 * @returns 提取的错误消息
 */
export function extractUpstreamError(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText);
    // 尝试多种错误格式
    return parsed.error?.message || parsed.message || parsed.error || '';
  } catch {
    // 非JSON响应,截取前200字符
    return errorText.slice(0, 200);
  }
}

/**
 * 构建结构化错误响应
 * @param status HTTP状态码
 * @param upstreamError 上游详细错误信息
 * @returns 结构化错误响应对象
 */
export function buildErrorResponse(status: number, upstreamError?: string): ErrorResponse {
  const mapping = ERROR_MESSAGES[status] || {
    message: `服务异常 (${status})`,
    code: 'UNKNOWN_ERROR',
    suggestion: '请联系技术支持',
  };

  return {
    error: mapping.message,
    detail: upstreamError,
    code: mapping.code,
    suggestion: mapping.suggestion,
  };
}

/**
 * 记录结构化错误日志
 * @param context 上下文信息 (如API路由名称)
 * @param status HTTP状态码
 * @param error 错误信息
 */
export function logError(context: string, status: number, error: string): void {
  const level = status >= 500 ? 'ERROR' : 'WARN';
  const timestamp = new Date().toISOString();
  
  console.log(`[${level}] [${timestamp}] [${context}] Status: ${status}`, error);
}

/**
 * 处理AI API错误并返回Next.js响应
 * @param context API路由上下文
 * @param response 上游AI API响应
 * @returns 结构化的NextResponse错误对象
 */
export async function handleAIAPIError(
  context: string,
  response: Response
): Promise<{ errorResponse: ErrorResponse; status: number }> {
  const errorText = await response.text();
  const status = response.status;
  
  // 提取上游详细错误
  const upstreamError = extractUpstreamError(errorText);
  
  // 记录日志
  logError(context, status, upstreamError || errorText);
  
  // 构建结构化错误响应
  const errorResponse = buildErrorResponse(status, upstreamError);
  
  return { errorResponse, status };
}

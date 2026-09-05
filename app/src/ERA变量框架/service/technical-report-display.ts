/** 只展开显示副本中的已知响应 JSON，避免可读性格式化改写审计和历史原文。 */
export function formatEraReportForDisplay(text: string): string {
  try {
    const report = JSON.parse(text);
    if (report && typeof report === 'object' && Array.isArray(report.attempts)) {
      for (const attempt of report.attempts) {
        if (!attempt || typeof attempt !== 'object' || typeof attempt.response !== 'string') continue;
        try {
          attempt.response = JSON.parse(attempt.response);
        } catch {
          // 非 JSON 响应保持原文，不能把自由文本误解释成另一份报告。
        }
      }
    }
    return JSON.stringify(report, null, 2);
  } catch {
    return text;
  }
}

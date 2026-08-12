import type { FindingSeed, FunctionFact, ParsedFile, QualityPolicy } from './types.ts';

/**
 * 检查单文件与函数的规模，并基于解析阶段生成的规范化 AST 指纹发现重复实现。
 *
 * 这里刻意不计算“综合分”：每条 finding 都保留原始观测值和阈值，使 baseline
 * 能够判断债务究竟是在减少还是增加。
 */
export function structureFindings(files: ParsedFile[], policy: QualityPolicy): FindingSeed[] {
  const findings = files.flatMap(file => [...fileStructureFindings(file, policy), ...functionFindings(file, policy)]);
  findings.push(...duplicateFunctionFindings(files, policy));
  return findings.sort(compareFindings);
}

function fileStructureFindings(file: ParsedFile, policy: QualityPolicy): FindingSeed[] {
  const { thresholds } = policy;
  const findings: FindingSeed[] = [];

  if (file.codeLines > thresholds.maxFileLines) {
    findings.push(
      fileFinding(
        file,
        'STRUCT_FILE_LINES',
        'error',
        file.codeLines,
        thresholds.maxFileLines,
        file.codeLines - thresholds.maxFileLines,
        `文件共有 ${file.codeLines} 行非注释代码，超过 ${thresholds.maxFileLines} 行的硬上限。`,
        '按职责拆分模块，并让入口文件只保留组合与导出。',
      ),
    );
  } else if (file.codeLines >= thresholds.warnFileLines) {
    findings.push(
      fileFinding(
        file,
        'STRUCT_FILE_LINES',
        'warning',
        file.codeLines,
        thresholds.warnFileLines,
        file.codeLines - thresholds.warnFileLines + 1,
        `文件共有 ${file.codeLines} 行非注释代码，已进入 ${thresholds.warnFileLines} 行以上的维护风险区间。`,
        '检查是否能按稳定职责拆出内部模块。',
      ),
    );
  }

  if (file.bytes > thresholds.maxFileBytes) {
    findings.push(
      fileFinding(
        file,
        'STRUCT_FILE_BYTES',
        'error',
        file.bytes,
        thresholds.maxFileBytes,
        file.bytes - thresholds.maxFileBytes,
        `文件大小为 ${file.bytes} 字节，超过 ${thresholds.maxFileBytes} 字节。`,
        '移出内嵌数据或生成内容，并拆分过大的实现。',
      ),
    );
  }

  pushFileCountFinding(
    findings,
    file,
    'STRUCT_FILE_FUNCTIONS',
    file.functionCount,
    thresholds.maxFunctionsPerFile,
    '函数',
    '将相互独立的函数组拆到职责明确的模块。',
  );
  pushFileCountFinding(
    findings,
    file,
    'STRUCT_FILE_CLASSES',
    file.classCount,
    thresholds.maxClassesPerFile,
    '类',
    '按领域职责拆分类定义，避免单文件承载多个子系统。',
  );
  pushFileCountFinding(
    findings,
    file,
    'STRUCT_FILE_EXPORTS',
    file.exportCount,
    thresholds.maxExportsPerFile,
    '顶层导出',
    '收窄公共接口，或按领域拆分导出入口。',
  );
  pushFileCountFinding(
    findings,
    file,
    'STRUCT_FILE_BRANCHES',
    file.branchCount,
    thresholds.maxFileBranches,
    '分支',
    '拆分决策密集的职责，并用数据表或纯函数表达规则。',
  );

  return findings;
}

function pushFileCountFinding(
  findings: FindingSeed[],
  file: ParsedFile,
  ruleId: string,
  observed: number,
  limit: number,
  label: string,
  suggestedFix: string,
): void {
  if (observed <= limit) {
    return;
  }
  findings.push(
    fileFinding(
      file,
      ruleId,
      'warning',
      observed,
      limit,
      observed - limit,
      `文件包含 ${observed} 个${label}，超过建议上限 ${limit}。`,
      suggestedFix,
    ),
  );
}

function functionFindings(file: ParsedFile, policy: QualityPolicy): FindingSeed[] {
  const { thresholds } = policy;
  return file.functions.flatMap(fn => {
    const findings: FindingSeed[] = [];
    pushFunctionFinding(
      findings,
      file,
      fn,
      'STRUCT_FUNCTION_LINES',
      fn.codeLines,
      thresholds.maxFunctionLines,
      '非注释代码行数',
      '提取有明确输入输出的步骤，并保留一个负责协调的短函数。',
    );
    pushFunctionFinding(
      findings,
      file,
      fn,
      'STRUCT_FUNCTION_BRANCHES',
      fn.branches,
      thresholds.maxFunctionBranches,
      '分支数',
      '把独立决策拆为纯函数或声明式规则表。',
    );
    pushFunctionFinding(
      findings,
      file,
      fn,
      'STRUCT_FUNCTION_NESTING',
      fn.maxNestingDepth,
      thresholds.maxFunctionNesting,
      '控制流嵌套深度',
      '使用提前返回或提取函数降低嵌套。',
    );
    pushFunctionFinding(
      findings,
      file,
      fn,
      'STRUCT_FUNCTION_PARAMS',
      fn.requiredParams,
      thresholds.maxFunctionParams,
      '必需参数数',
      '将强相关参数组合为有名称的配置或上下文对象。',
    );
    return findings;
  });
}

function pushFunctionFinding(
  findings: FindingSeed[],
  file: ParsedFile,
  fn: FunctionFact,
  ruleId: string,
  observed: number,
  limit: number,
  label: string,
  suggestedFix: string,
): void {
  if (observed <= limit) {
    return;
  }
  findings.push({
    ruleId,
    severity: 'warning',
    category: 'structure',
    objectType: 'function',
    objectId: fn.objectId,
    path: file.path,
    line: fn.lineStart,
    column: 1,
    observed,
    limit,
    debt: observed - limit,
    message: `函数 ${fn.qualifiedName} 的${label}为 ${observed}，超过建议上限 ${limit}。`,
    suggestedFix,
    evidenceKey: `${fn.qualifiedName}:${observed}`,
  });
}

function duplicateFunctionFindings(files: ParsedFile[], policy: QualityPolicy): FindingSeed[] {
  const byFingerprint = new Map<string, Array<{ file: ParsedFile; fn: FunctionFact }>>();

  for (const file of files) {
    for (const fn of file.functions) {
      if (fn.codeLines < policy.thresholds.minDuplicateFunctionLines || fn.astFingerprint.length === 0) {
        continue;
      }
      const occurrences = byFingerprint.get(fn.astFingerprint) ?? [];
      occurrences.push({ file, fn });
      byFingerprint.set(fn.astFingerprint, occurrences);
    }
  }

  const findings: FindingSeed[] = [];
  for (const [fingerprint, unsortedOccurrences] of byFingerprint) {
    if (unsortedOccurrences.length < 2) {
      continue;
    }
    const occurrences = [...unsortedOccurrences].sort((left, right) => {
      return (
        left.file.path.localeCompare(right.file.path, 'zh-CN') ||
        left.fn.qualifiedName.localeCompare(right.fn.qualifiedName, 'zh-CN')
      );
    });
    const locations = occurrences.map(({ file, fn }) => `${file.path}:${fn.lineStart} (${fn.qualifiedName})`);

    for (const { file, fn } of occurrences) {
      const peers = locations.filter(location => !location.startsWith(`${file.path}:${fn.lineStart} (`));
      findings.push({
        ruleId: 'STRUCT_DUPLICATE_FUNCTION',
        severity: 'warning',
        category: 'structure',
        objectType: 'function',
        objectId: fn.objectId,
        path: file.path,
        line: fn.lineStart,
        column: 1,
        observed: occurrences.length,
        limit: 1,
        debt: occurrences.length - 1,
        message: `函数 ${fn.qualifiedName} 与 ${occurrences.length - 1} 个其他函数具有相同的规范化 AST 结构。`,
        suggestedFix: '确认这些实现是否表达同一规则；若是，请提取共享实现，否则让差异在结构上明确可见。',
        evidenceKey: fingerprint,
        details: { duplicates: peers },
      });
    }
  }

  return findings;
}

function fileFinding(
  file: ParsedFile,
  ruleId: string,
  severity: 'error' | 'warning',
  observed: number,
  limit: number,
  debt: number,
  message: string,
  suggestedFix: string,
): FindingSeed {
  return {
    ruleId,
    severity,
    category: 'structure',
    objectType: 'file',
    objectId: file.moduleName,
    path: file.path,
    line: 1,
    column: 1,
    observed,
    limit,
    debt,
    message,
    suggestedFix,
    evidenceKey: `${observed}`,
  };
}

function compareFindings(left: FindingSeed, right: FindingSeed): number {
  return (
    left.path.localeCompare(right.path, 'zh-CN') ||
    left.line - right.line ||
    left.column - right.column ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

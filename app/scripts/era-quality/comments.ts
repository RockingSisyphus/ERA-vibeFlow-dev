import { existsSync } from 'node:fs';
import { dirname, join, normalize, posix } from 'node:path';

import { classifyDirectCapability, classifyImportCapability } from './effects.ts';
import type {
  CommentFact,
  CommentMetrics,
  FindingSeed,
  FunctionFact,
  ParsedFile,
  QualityPolicy,
  TypeFact,
} from './types.ts';

export interface CommentAnalysis {
  findings: FindingSeed[];
  metrics: CommentMetrics;
}

interface CommentClassification {
  prose: string;
  han: number;
  naturalLanguage: boolean;
  chinese: boolean;
  exempt: boolean;
  meta: boolean;
  history: boolean;
  whatNarration: boolean;
}

interface DisabledCodeGroup {
  section: CommentFact['section'];
  comments: CommentFact[];
  lineStart: number;
  lineEnd: number;
  physicalLines: number;
  codeLines: number;
  ratio: number;
}

/**
 * 以确定性规则检查中文注释。所有启发式低质量规则都采取保守匹配；
 * 无法由局部静态证据证明的“注释是否符合实现”不在本函数中猜测。
 */
export function commentFindings(files: ParsedFile[], policy: QualityPolicy): CommentAnalysis {
  const findings: FindingSeed[] = [];
  const metrics: CommentMetrics = {
    total: 0,
    naturalLanguage: 0,
    chinese: 0,
    usefulChineseLines: 0,
    scriptCodeLines: 0,
  };
  const classifications = new Map<string, CommentClassification>();

  for (const file of files) {
    const fencedCommentIds = findFencedCodeCommentIds(file);
    const disabledGroups = findDisabledCodeGroups(file, policy, fencedCommentIds);
    const disabledCommentIds = new Set(disabledGroups.flatMap(group => group.comments.map(comment => comment.id)));
    let usefulChineseLines = 0;

    metrics.scriptCodeLines += file.scriptCodeLines;
    metrics.total += file.comments.length;

    for (const comment of file.comments) {
      const disabledCode = disabledCommentIds.has(comment.id);
      const fencedCode = fencedCommentIds.has(comment.id);
      const classification =
        disabledCode || fencedCode
          ? {
              prose: cleanCommentText(comment.raw),
              han: 0,
              naturalLanguage: false,
              chinese: false,
              exempt: true,
              meta: false,
              history: false,
              whatNarration: false,
            }
          : classifyComment(comment, policy);
      classifications.set(commentKey(file, comment), classification);
      if (classification.naturalLanguage) {
        metrics.naturalLanguage += 1;
      }
      if (classification.naturalLanguage && classification.chinese) {
        metrics.chinese += 1;
      }

      if (!disabledCode && !fencedCode) {
        findings.push(...basicCommentFindings(file, comment, classification, policy));
        findings.push(...todoFindings(file, comment, classification, policy));
        findings.push(...staleFileReferenceFindings(files, file, comment));
      }
      if (comment.section === 'script' && !disabledCode && !fencedCode) {
        usefulChineseLines += countUsefulChineseLines(comment, classification, policy);
      }
    }

    metrics.usefulChineseLines += usefulChineseLines;
    findings.push(...disabledCodeFindings(file, disabledGroups, policy));
    findings.push(...commentRatioFindings(file, usefulChineseLines, policy));
    findings.push(...moduleDocumentationFindings(file, classifications, policy));
    findings.push(...criticalFunctionDocumentationFindings(file, classifications, policy));
    findings.push(...typeDocumentationFindings(file, classifications, policy));
    findings.push(...jsdocContractFindings(file));
  }

  findings.push(...duplicateProseFindings(files, classifications, policy));
  findings.sort(compareFindings);
  return { findings, metrics };
}

function basicCommentFindings(
  file: ParsedFile,
  comment: CommentFact,
  classification: CommentClassification,
  policy: QualityPolicy,
): FindingSeed[] {
  if (classification.exempt) {
    return [];
  }

  const findings: FindingSeed[] = [];
  if (classification.naturalLanguage && !classification.chinese) {
    findings.push(
      commentFinding(
        file,
        comment,
        'COMMENT_CHINESE_PRIMARY',
        'warning',
        classification.han,
        1,
        1,
        '自然语言注释没有中文内容。',
        '以中文说明意图；API 名、类型名和必要英文术语可以保留。',
        classification.prose,
      ),
    );
  }
  if (classification.meta) {
    findings.push(
      commentFinding(
        file,
        comment,
        'COMMENT_META_WORDING',
        'warning',
        classification.prose,
        '直接说明设计意图',
        1,
        '注释在描述“添加中文注释”这件事，而不是解释代码。',
        '删除“中文注释/补充注释”等元话语，直接说明约束、原因或风险。',
        classification.prose,
      ),
    );
  }
  if (classification.history && !containsRationale(classification.prose, policy)) {
    findings.push(
      commentFinding(
        file,
        comment,
        'COMMENT_DEVELOPMENT_HISTORY',
        'warning',
        classification.prose,
        '当前设计理由',
        1,
        '注释记录了修改过程，但没有说明当前实现必须如此的理由。',
        '改写为当前仍成立的约束、兼容性原因或失败风险；无长期价值时直接删除。',
        classification.prose,
      ),
    );
  }
  if (classification.whatNarration) {
    findings.push(
      commentFinding(
        file,
        comment,
        'COMMENT_WHAT_NARRATION',
        'warning',
        classification.prose,
        '原因或约束',
        1,
        '短注释仅复述了紧邻代码可以直接看出的动作。',
        '删除该注释，或改为解释这里不明显的原因、边界和失败后果。',
        classification.prose,
      ),
    );
  }
  return findings;
}

function commentRatioFindings(file: ParsedFile, usefulChineseLines: number, policy: QualityPolicy): FindingSeed[] {
  const { comments } = policy;
  if (file.scriptCodeLines < comments.largeFileCodeLines) {
    return [];
  }

  const ratio = file.scriptCodeLines === 0 ? 0 : usefulChineseLines / file.scriptCodeLines;
  if (ratio < comments.minimumUsefulRatio) {
    const requiredLines = Math.ceil(file.scriptCodeLines * comments.minimumUsefulRatio);
    return [
      {
        ruleId: 'COMMENT_USEFUL_RATIO_LOW',
        severity: 'warning',
        category: 'comment',
        objectType: 'file',
        objectId: file.moduleName,
        path: file.path,
        line: 1,
        column: 1,
        observed: roundRatio(ratio),
        limit: comments.minimumUsefulRatio,
        debt: Math.max(1, requiredLines - usefulChineseLines),
        message: `脚本逻辑有 ${file.scriptCodeLines} 行，仅有 ${usefulChineseLines} 行有效中文注释。`,
        suggestedFix: '优先为复杂状态变化、外部副作用、兼容约束和失败路径补充中文说明。',
        evidenceKey: `${usefulChineseLines}/${file.scriptCodeLines}`,
      },
    ];
  }
  if (ratio > comments.highUsefulRatio) {
    return [
      {
        ruleId: 'COMMENT_USEFUL_RATIO_HIGH',
        severity: 'info',
        category: 'comment',
        objectType: 'file',
        objectId: file.moduleName,
        path: file.path,
        line: 1,
        column: 1,
        observed: roundRatio(ratio),
        limit: comments.highUsefulRatio,
        debt: 0,
        message: `有效中文注释比例为 ${formatPercent(ratio)}；这是文档密集提示，不作为质量惩罚。`,
        suggestedFix: '仅需确认注释没有重复实现细节或保留已失效的历史说明。',
        evidenceKey: `${usefulChineseLines}/${file.scriptCodeLines}`,
      },
    ];
  }
  return [];
}

function moduleDocumentationFindings(
  file: ParsedFile,
  classifications: Map<string, CommentClassification>,
  policy: QualityPolicy,
): FindingSeed[] {
  const requirements = policy.comments;
  if (file.scriptCodeLines < requirements.moduleDocCodeLines && file.exportCount < requirements.moduleDocExports) {
    return [];
  }

  const candidate = findModuleComment(file);
  const classification = candidate ? classifications.get(commentKey(file, candidate)) : undefined;
  const prose = classification?.prose ?? '';
  const hasResponsibility = /负责|用于|提供|实现|管理|处理|定义|封装|协调|组织|承载/u.test(prose);
  const hasBoundary = /边界|职责|范围|入口|出口|仅|不得|不会|不能|依赖|副作用|约束|不包含/u.test(prose);
  const good =
    candidate?.section === 'script' &&
    candidate.attachedObjectId === undefined &&
    classification?.chinese === true &&
    classification.han >= requirements.minimumModuleDocHan &&
    hasResponsibility &&
    hasBoundary;

  if (good) {
    return [];
  }

  const missing: string[] = [];
  if (!candidate) {
    missing.push('文件顶部的独立说明');
  } else {
    if ((classification?.han ?? 0) < requirements.minimumModuleDocHan) {
      missing.push(`至少 ${requirements.minimumModuleDocHan} 个汉字`);
    }
    if (!hasResponsibility) {
      missing.push('模块职责');
    }
    if (!hasBoundary) {
      missing.push('模块边界');
    }
  }
  return [
    {
      ruleId: 'COMMENT_MODULE_DOC',
      severity: 'warning',
      category: 'comment',
      objectType: 'file',
      objectId: file.moduleName,
      path: file.path,
      line: candidate?.lineStart ?? 1,
      column: candidate?.column ?? 1,
      observed: classification?.han ?? 0,
      limit: requirements.minimumModuleDocHan,
      debt: Math.max(1, requirements.minimumModuleDocHan - (classification?.han ?? 0)),
      message: `大型或公共接口密集模块缺少合格的中文模块说明：${missing.join('、')}。`,
      suggestedFix: '在 import 之前添加独立中文模块说明，同时交代它负责什么以及明确不负责或依赖什么。',
      evidenceKey: prose || 'missing-module-doc',
      details: { missing },
    },
  ];
}

function criticalFunctionDocumentationFindings(
  file: ParsedFile,
  classifications: Map<string, CommentClassification>,
  policy: QualityPolicy,
): FindingSeed[] {
  const findings: FindingSeed[] = [];
  const commentsById = new Map(file.comments.map(comment => [comment.id, comment]));

  for (const fn of file.functions) {
    const reasons = criticalFunctionReasons(file, fn, policy);
    if (reasons.length === 0) {
      continue;
    }
    const comment = fn.leadingCommentId ? commentsById.get(fn.leadingCommentId) : undefined;
    const classification = comment ? classifications.get(commentKey(file, comment)) : undefined;
    if (!comment || comment.kind !== 'jsdoc') {
      findings.push(
        functionCommentFinding(
          file,
          fn,
          'COMMENT_CRITICAL_DOC_MISSING',
          'warning',
          false,
          true,
          1,
          `关键函数 ${fn.qualifiedName} 没有直接相邻的 JSDoc 中文说明。`,
          '在函数声明正上方添加 JSDoc，说明设计理由、约束与失败路径。',
          reasons,
        ),
      );
      continue;
    }

    const han = classification?.han ?? 0;
    if (classification?.chinese !== true || han < policy.comments.minimumCriticalDocHan) {
      findings.push(
        functionCommentFinding(
          file,
          fn,
          'COMMENT_CRITICAL_DOC_CHINESE',
          'warning',
          han,
          policy.comments.minimumCriticalDocHan,
          Math.max(1, policy.comments.minimumCriticalDocHan - han),
          `关键函数 ${fn.qualifiedName} 的 JSDoc 中文说明不足。`,
          `用至少 ${policy.comments.minimumCriticalDocHan} 个汉字解释该函数的契约与风险。`,
          reasons,
          classification?.prose,
        ),
      );
    }
    if (!containsRationale(classification?.prose ?? '', policy)) {
      findings.push(
        functionCommentFinding(
          file,
          fn,
          'COMMENT_CRITICAL_DOC_RATIONALE',
          'warning',
          false,
          true,
          1,
          `关键函数 ${fn.qualifiedName} 的 JSDoc 只描述职责，没有明确原因或约束。`,
          `补充“为了/否则/必须/避免”等可验证的设计理由；不要只复述函数名。`,
          reasons,
          classification?.prose,
        ),
      );
    }
  }

  return findings;
}

function typeDocumentationFindings(
  file: ParsedFile,
  classifications: Map<string, CommentClassification>,
  policy: QualityPolicy,
): FindingSeed[] {
  const commentsById = new Map(file.comments.map(comment => [comment.id, comment]));
  const findings: FindingSeed[] = [];

  for (const type of file.types) {
    if (!type.exported || type.memberCount < 3) {
      continue;
    }
    const comment = type.leadingCommentId ? commentsById.get(type.leadingCommentId) : undefined;
    const classification = comment ? classifications.get(commentKey(file, comment)) : undefined;
    const han = classification?.han ?? 0;
    if (comment?.kind === 'jsdoc' && classification?.chinese === true && han >= policy.comments.minimumTypeDocHan) {
      continue;
    }
    findings.push(typeCommentFinding(file, type, han, policy.comments.minimumTypeDocHan));
  }
  return findings;
}

function jsdocContractFindings(file: ParsedFile): FindingSeed[] {
  const functionsByComment = new Map<string, FunctionFact>();
  for (const fn of file.functions) {
    if (fn.leadingCommentId) {
      functionsByComment.set(fn.leadingCommentId, fn);
    }
  }
  const findings: FindingSeed[] = [];
  const seen = new Set<string>();

  for (const comment of file.comments) {
    if (comment.kind !== 'jsdoc') {
      continue;
    }
    const fn = functionsByComment.get(comment.id);
    const tagLines = cleanCommentLines(comment.raw).filter(line => line.trimStart().startsWith('@'));
    for (const line of tagLines) {
      const tag = parseJSDocTag(line);
      if (!tag) {
        continue;
      }
      if (tag.requiresDescription && tag.description.length === 0) {
        const key = `${comment.id}\0empty\0${tag.name}\0${tag.parameter ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          findings.push(
            commentFinding(
              file,
              comment,
              'COMMENT_JSDOC_EMPTY_TAG',
              'warning',
              `@${tag.name}`,
              '非空说明',
              1,
              `JSDoc 的 @${tag.name} 标签没有说明文本。`,
              '补充参数语义、返回约束或异常条件；没有信息价值的标签应删除。',
              `${tag.name}:${tag.parameter ?? ''}`,
            ),
          );
        }
      }
      if (tag.name === 'param' && tag.parameter && fn) {
        const actualNames = new Set(fn.parameterNames.filter(name => /^[A-Za-z_$][\w$]*$/u.test(name)));
        if (actualNames.size > 0 && !actualNames.has(tag.parameter)) {
          const key = `${comment.id}\0mismatch\0${tag.parameter}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          findings.push(
            commentFinding(
              file,
              comment,
              'COMMENT_JSDOC_PARAM_MISMATCH',
              'warning',
              tag.parameter,
              [...actualNames].sort().join(', '),
              1,
              `JSDoc 记录了不存在的参数 “${tag.parameter}”。`,
              '将 @param 名称改为真实形参，或删除已经失效的标签。',
              `${fn.qualifiedName}:${tag.parameter}`,
              fn.objectId,
            ),
          );
        }
      }
    }
  }
  return findings;
}

function todoFindings(
  file: ParsedFile,
  comment: CommentFact,
  classification: CommentClassification,
  policy: QualityPolicy,
): FindingSeed[] {
  if (!/\b(?:TODO|FIXME|HACK)\b/iu.test(comment.raw)) {
    return [];
  }
  const hasReason =
    classification.han >= policy.comments.minimumHanForUseful && containsRationale(classification.prose, policy);
  const hasExitOrTracking =
    /(?:完成|解决|移除|删除|截止|到期|验收|条件|之后|后即可|时即可)/u.test(classification.prose) ||
    /(?:#\d+|[A-Z][A-Z0-9]+-\d+|https?:\/\/\S+)/u.test(comment.raw);
  if (hasReason && hasExitOrTracking) {
    return [];
  }
  const missing = [!hasReason ? '中文原因' : '', !hasExitOrTracking ? '完成条件或跟踪编号' : ''].filter(Boolean);
  return [
    commentFinding(
      file,
      comment,
      'COMMENT_TODO_CONTEXT',
      'warning',
      missing.join('、'),
      '中文原因及完成条件/跟踪编号',
      missing.length,
      `TODO/FIXME/HACK 缺少${missing.join('和')}。`,
      '说明为何暂时保留，并给出删除条件、截止条件或 issue 编号。',
      classification.prose,
    ),
  ];
}

function staleFileReferenceFindings(allFiles: ParsedFile[], file: ParsedFile, comment: CommentFact): FindingSeed[] {
  const withoutUrls = comment.raw.replace(/https?:\/\/\S+/giu, ' ');
  const references = [
    ...withoutUrls.matchAll(/(?<![\w.-])((?:\.{0,2}\/)?[\w@/.\-\u3400-\u9fff]+?\.(?:ts|vue))(?![\w.-])/giu),
  ].map(match => match[1]);
  const stale = [...new Set(references)].filter(reference => {
    return !reference.endsWith('.d.ts') && !referenceExists(allFiles, file, reference);
  });

  return stale.map(reference =>
    commentFinding(
      file,
      comment,
      'COMMENT_STALE_FILE_REFERENCE',
      'warning',
      reference,
      '可解析的现存文件',
      1,
      `注释引用的文件 “${reference}” 无法解析。`,
      '更新为当前文件名；如果只是概念名称，请不要写成带扩展名的路径。',
      reference,
    ),
  );
}

function duplicateProseFindings(
  files: ParsedFile[],
  classifications: Map<string, CommentClassification>,
  policy: QualityPolicy,
): FindingSeed[] {
  const groups = new Map<
    string,
    Array<{ file: ParsedFile; comment: CommentFact; classification: CommentClassification; owner: string }>
  >();
  for (const file of files) {
    for (const comment of file.comments) {
      const classification = classifications.get(commentKey(file, comment));
      if (
        !classification ||
        classification.exempt ||
        !classification.chinese ||
        classification.han < policy.comments.duplicateProseHan
      ) {
        continue;
      }
      const normalized = normalizeDuplicateProse(classification.prose);
      if (countHan(normalized) < policy.comments.duplicateProseHan) {
        continue;
      }
      const owner = comment.attachedObjectId ?? `${file.path}:${comment.section}:${comment.lineStart}`;
      const group = groups.get(normalized) ?? [];
      group.push({ file, comment, classification, owner });
      groups.set(normalized, group);
    }
  }

  const findings: FindingSeed[] = [];
  for (const [normalized, rawGroup] of groups) {
    const owners = new Set(rawGroup.map(item => item.owner));
    if (owners.size < 2) {
      continue;
    }
    const group = [...rawGroup].sort((left, right) => {
      return left.file.path.localeCompare(right.file.path, 'zh-CN') || left.comment.lineStart - right.comment.lineStart;
    });
    const locations = group.map(item => `${item.file.path}:${item.comment.lineStart}`);
    for (const item of group) {
      findings.push(
        commentFinding(
          item.file,
          item.comment,
          'COMMENT_DUPLICATE_PROSE',
          'warning',
          owners.size,
          1,
          owners.size - 1,
          `这段较长说明被复制到 ${owners.size} 个不同对象。`,
          '保留一处权威契约并让其他位置引用概念名，避免多份说明分别失效。',
          normalized,
          item.comment.attachedObjectId,
          { duplicates: locations.filter(location => location !== `${item.file.path}:${item.comment.lineStart}`) },
        ),
      );
    }
  }
  return findings;
}

function findFencedCodeCommentIds(file: ParsedFile): Set<string> {
  const result = new Set<string>();
  const sections: CommentFact['section'][] = ['script', 'template', 'style'];

  for (const section of sections) {
    const comments = file.comments
      .filter(comment => comment.section === section)
      .sort((left, right) => left.range[0] - right.range[0]);
    let openingIndex: number | undefined;
    let previous: CommentFact | undefined;

    comments.forEach((comment, index) => {
      if (
        openingIndex !== undefined &&
        previous !== undefined &&
        (comment.kind !== previous.kind || comment.lineStart > previous.lineEnd + 1)
      ) {
        openingIndex = undefined;
      }
      const markerCount = rawCommentContentLines(comment.raw).filter(line => /^```/u.test(line.trim())).length;
      for (let marker = 0; marker < markerCount; marker += 1) {
        if (openingIndex === undefined) {
          openingIndex = index;
          continue;
        }
        for (let fencedIndex = openingIndex; fencedIndex <= index; fencedIndex += 1) {
          result.add(comments[fencedIndex].id);
        }
        openingIndex = undefined;
      }
      previous = comment;
    });
  }

  return result;
}

function findDisabledCodeGroups(
  file: ParsedFile,
  policy: QualityPolicy,
  fencedCommentIds: ReadonlySet<string>,
): DisabledCodeGroup[] {
  const candidates = file.comments
    .filter(comment => {
      if (comment.kind === 'jsdoc' || fencedCommentIds.has(comment.id)) {
        return false;
      }
      const prose = cleanCommentText(comment.raw);
      return !isExemptComment(prose) || (comment.kind === 'line' && prose.length === 0);
    })
    .sort((left, right) => left.range[0] - right.range[0]);
  const groups: CommentFact[][] = [];

  for (const comment of candidates) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (
      current &&
      previous &&
      previous.section === comment.section &&
      previous.kind === comment.kind &&
      comment.lineStart <= previous.lineEnd + 1
    ) {
      current.push(comment);
    } else {
      groups.push([comment]);
    }
  }

  return groups
    .map(comments => {
      const lines = comments.flatMap(comment => cleanCommentLines(comment.raw)).filter(line => line.trim().length > 0);
      const codeLines = lines.filter((line, index) =>
        isHighConfidenceCodeLine(line, comments[0].section, lines[index + 1]),
      ).length;
      const physicalLines = lines.length;
      return {
        section: comments[0].section,
        comments,
        lineStart: comments[0].lineStart,
        lineEnd: comments.at(-1)?.lineEnd ?? comments[0].lineEnd,
        physicalLines,
        codeLines,
        ratio: physicalLines === 0 ? 0 : codeLines / physicalLines,
      };
    })
    .filter(group => {
      if (group.codeLines === 0) {
        return false;
      }
      if (group.physicalLines >= policy.comments.disabledBlockLines) {
        return group.ratio >= policy.comments.disabledBlockCodeRatio;
      }
      return group.ratio >= Math.max(0.8, policy.comments.disabledBlockCodeRatio);
    });
}

function disabledCodeFindings(file: ParsedFile, groups: DisabledCodeGroup[], policy: QualityPolicy): FindingSeed[] {
  return groups.map(group => {
    const block = group.physicalLines >= policy.comments.disabledBlockLines;
    const first = group.comments[0];
    return commentFinding(
      file,
      first,
      'COMMENT_DISABLED_CODE',
      block ? 'error' : 'warning',
      group.codeLines,
      block ? policy.comments.disabledBlockLines - 1 : 0,
      group.codeLines,
      block
        ? `连续注释块包含 ${group.codeLines}/${group.physicalLines} 行高置信代码，疑似保留了禁用实现。`
        : '注释中包含一条高置信的禁用代码语句。',
      '删除失效实现；需要保留历史时依赖版本控制，需要示例时放入明确的 @example 或代码围栏。',
      `${group.section}:${group.comments.map(comment => cleanCommentText(comment.raw)).join('\n')}`,
      undefined,
      {
        lineEnd: group.lineEnd,
        ratio: roundRatio(group.ratio),
      },
    );
  });
}

function classifyComment(comment: CommentFact, policy: QualityPolicy): CommentClassification {
  const prose = cleanCommentText(comment.raw);
  const exempt = isExemptComment(prose);
  const han = countHan(prose);
  const naturalLanguage = !exempt && isNaturalLanguage(prose, comment.kind);
  const meta = !exempt && /(?:中文注释|补充中文注释|添加中文注释|增加中文注释|注释说明)\s*[:：]?/u.test(prose);
  const history =
    !exempt &&
    policy.comments.historyWords.some(
      word => word.length > 0 && prose.toLocaleLowerCase().includes(word.toLocaleLowerCase()),
    );
  return {
    prose,
    han,
    naturalLanguage,
    chinese: naturalLanguage && han > 0,
    exempt,
    meta,
    history,
    whatNarration: !exempt && isHighConfidenceWhatNarration(comment, prose, policy),
  };
}

function countUsefulChineseLines(
  comment: CommentFact,
  classification: CommentClassification,
  policy: QualityPolicy,
): number {
  if (
    classification.exempt ||
    classification.meta ||
    classification.history ||
    classification.whatNarration ||
    !classification.chinese
  ) {
    return 0;
  }
  return cleanCommentLines(comment.raw).filter(line => {
    const prose = cleanInlineMarkup(line);
    return (
      countHan(prose) >= policy.comments.minimumHanForUseful &&
      !isExemptComment(prose) &&
      !isHighConfidenceCodeLine(prose, comment.section)
    );
  }).length;
}

function isHighConfidenceWhatNarration(comment: CommentFact, prose: string, policy: QualityPolicy): boolean {
  if (
    comment.kind === 'jsdoc' ||
    prose.length === 0 ||
    countHan(prose) > 14 ||
    containsRationale(prose, policy) ||
    /[？?]/u.test(prose)
  ) {
    return false;
  }
  const following = comment.followingCode?.trim() ?? '';
  if (comment.section === 'template') {
    return (
      following.startsWith('<') &&
      /^(?:头部|标题|内容|按钮|容器|列表|表格|页脚|图标|输入框|弹窗|面板|标签|导航|区域|工具栏|状态栏)(?:区域|部分|容器)?[。.]?$/u.test(
        prose,
      )
    );
  }
  if (comment.section === 'style') {
    const mappings: Array<[RegExp, RegExp]> = [
      [/^(?:设置)?(?:背景|背景色)[。.]?$/u, /\bbackground(?:-color)?\s*:/u],
      [/^(?:设置)?(?:颜色|文字颜色)[。.]?$/u, /(?:^|\s)color\s*:/u],
      [/^(?:设置)?内边距[。.]?$/u, /\bpadding(?:-\w+)?\s*:/u],
      [/^(?:设置)?外边距[。.]?$/u, /\bmargin(?:-\w+)?\s*:/u],
      [/^(?:设置)?圆角[。.]?$/u, /\bborder-radius\s*:/u],
      [/^(?:设置)?边框[。.]?$/u, /\bborder(?:-\w+)?\s*:/u],
      [/^(?:设置)?字体大小[。.]?$/u, /\bfont-size\s*:/u],
    ];
    return mappings.some(([commentPattern, codePattern]) => commentPattern.test(prose) && codePattern.test(following));
  }

  const directPatterns: Array<[RegExp, RegExp]> = [
    [/^(?:导入|引入).+$/u, /^import\b/u],
    [/^(?:返回|直接返回).+$/u, /^return\b/u],
    [/^(?:设置|赋值).+$/u, /(?:^|[^=!<>])=(?!=)/u],
    [/^(?:调用|执行).+$/u, /\b[A-Za-z_$][\w$.[\]]*\s*\(/u],
    [/^(?:创建|获取|检查|更新|删除|初始化).+$/u, /\b(?:create|get|check|update|delete|remove|init)[A-Z_\w$]*\s*\(/iu],
  ];
  return (
    following.length > 0 &&
    directPatterns.some(([commentPattern, codePattern]) => commentPattern.test(prose) && codePattern.test(following))
  );
}

function isNaturalLanguage(prose: string, kind: CommentFact['kind']): boolean {
  if (prose.length === 0 || isHighConfidenceCodeLine(prose, 'script')) {
    return false;
  }
  if (countHan(prose) > 0) {
    return true;
  }
  const withoutTechnicalNoise = prose
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/`[^`]*`/gu, ' ')
    .replace(/@[A-Za-z][\w-]*(?:\s+\{[^}]*\})?(?:\s+\[?[\w$.-]+\]?)?/gu, ' ');
  const words = withoutTechnicalNoise.match(/[A-Za-z]{2,}/gu) ?? [];
  const letters = words.reduce((sum, word) => sum + word.length, 0);
  const connective =
    /\b(?:the|this|that|these|those|is|are|was|were|to|for|with|from|when|because|avoid|ensure|must|should|returns?|creates?|updates?|uses?)\b/iu.test(
      withoutTechnicalNoise,
    );
  return (
    (words.length >= 3 && letters >= 12) ||
    (words.length >= 2 && letters >= 12) ||
    (words.length >= 2 && letters >= 8 && (connective || kind === 'jsdoc'))
  );
}

function isExemptComment(prose: string): boolean {
  const trimmed = prose.trim();
  return (
    trimmed.length === 0 ||
    /^(?:[-=_*#~]{3,}|[┌┐└┘─│━═]+)$/u.test(trimmed) ||
    isToolDirective(trimmed) ||
    /^(?:SPDX-License-Identifier|Copyright\b|Licensed under\b|@license\b|@generated\b|generated\b)/iu.test(trimmed) ||
    /^https?:\/\/\S+$/iu.test(trimmed) ||
    /^```/u.test(trimmed) ||
    /^(?:@example|@see)\b/iu.test(trimmed)
  );
}

function isToolDirective(prose: string): boolean {
  return (
    /^eslint-(?:disable|enable)(?:-next-line|-line)?(?:\s+(?:@?[\w-]+\/)?[\w-]+(?:\s*,\s*(?:@?[\w-]+\/)?[\w-]+)*)?(?:\s+--\s+\S.*)?$/iu.test(
      prose,
    ) ||
    /^eslint-env\s+[A-Za-z][\w-]*(?:\s*,\s*[A-Za-z][\w-]*)*$/u.test(prose) ||
    /^prettier-ignore(?:-(?:start|end)|-attribute(?:\s+\([A-Za-z_:][\w:.-]*\))?)?$/iu.test(prose) ||
    /^stylelint-(?:disable|enable)(?:-line|-next-line)?(?:\s+[\w-]+(?:\s*,\s*[\w-]+)*)?(?:\s+--\s+\S.*)?$/iu.test(
      prose,
    ) ||
    /^c8\s+ignore\s+(?:next(?:\s+\d+)?|start|stop)$/iu.test(prose) ||
    /^istanbul\s+ignore\s+(?:if|else|next|file)$/iu.test(prose) ||
    /^webpack(?:ChunkName|Mode|Prefetch|Preload|FetchPriority|Ignore|Exports):\s*(?:"[^"]*"|'[^']*'|true|false|\d+|\[[^\]]*\])\s*,?$/u.test(
      prose,
    ) ||
    /^@vite-ignore$/iu.test(prose) ||
    /^@ts-(?:ignore|expect-error)(?::?\s+\S.*)?$/iu.test(prose) ||
    /^@ts-(?:nocheck|check)$/iu.test(prose)
  );
}

function isHighConfidenceCodeLine(rawLine: string, section: CommentFact['section'], nextLine = ''): boolean {
  const line = rawLine.trim();
  if (line.length === 0) {
    return false;
  }
  if (section === 'template') {
    return /^<\/?[A-Za-z][^>]*>$/u.test(line) || /^(?:v-|:|@)[\w-]+\s*=/u.test(line);
  }
  if (section === 'style') {
    return (
      /^(?:--[\w-]+|[a-z-]+)\s*:\s*[^;]+;?$/u.test(line) ||
      /^[.#:[\]A-Za-z][^{]*\{\s*$/u.test(line) ||
      /^[{}]$/u.test(line)
    );
  }
  const codeShape =
    /^(?:import|export)\s+.+\s+from\s+['"][^'"]+['"];?$/u.test(line) ||
    /^(?:const|let|var)\s+(?:[A-Za-z_$][\w$]*|\{[^}]+\}|\[[^\]]+\])\s*(?::[^=]+)?=\s*.+;?$/u.test(line) ||
    /^(?:return|throw)\b.+(?:;|\{)$/u.test(line) ||
    /^(?:await\s+)?[A-Za-z_$][\w$.[\]'"]*\s*\([^;]*\);$/u.test(line) ||
    /^(?:if|for|while|switch|catch)\s*\(.+\)\s*\{?$/u.test(line) ||
    /^(?:else|try|finally)\s*\{?$/u.test(line) ||
    /^(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/u.test(line) ||
    /^(?:class|interface|type)\s+[A-Za-z_$][\w$]*/u.test(line) ||
    /^[A-Za-z_$][\w$.[\]'"]*\s*(?:=|\+=|-=|\?\?=|\|\|=|&&=)\s*.+;$/u.test(line) ||
    /^(?:\}\s*)?[),]\s*[^;]*;$/u.test(line) ||
    (/^[{}[\](),;]+$/u.test(line) && nextLine.trim().length > 0);
  if (codeShape) {
    return true;
  }
  return !/[，。！？；：]/u.test(line) && countHan(line) < 3 && /^[A-Za-z_$][\w$.[\]'"]+\s*=>\s*\{/u.test(line);
}

function criticalFunctionReasons(file: ParsedFile, fn: FunctionFact, policy: QualityPolicy): string[] {
  const requirements = policy.comments;
  const reasons: string[] = [];
  if (fn.codeLines > requirements.criticalFunctionLines) {
    reasons.push(`超过 ${requirements.criticalFunctionLines} 行`);
  }
  if (fn.branches > requirements.criticalFunctionBranches) {
    reasons.push(`超过 ${requirements.criticalFunctionBranches} 个分支`);
  }
  if (fn.maxNestingDepth > requirements.criticalFunctionNesting) {
    reasons.push(`嵌套深度超过 ${requirements.criticalFunctionNesting}`);
  }
  if (fn.requiredParams > requirements.criticalFunctionParams) {
    reasons.push(`必需参数超过 ${requirements.criticalFunctionParams} 个`);
  }
  if (
    fn.exported &&
    (fn.codeLines > requirements.exportedFunctionLines || fn.branches > requirements.exportedFunctionBranches)
  ) {
    reasons.push('非平凡导出函数');
  }
  if (isLifecycleFunction(file, fn)) {
    reasons.push('注册或卸载生命周期');
  }
  const capabilityCount = usedCapabilityCategories(file, fn, policy).length;
  if (capabilityCount > 1) {
    reasons.push(`跨越 ${capabilityCount} 类副作用`);
  }
  return reasons;
}

function isLifecycleFunction(file: ParsedFile, fn: FunctionFact): boolean {
  if (/(?:register|unregister|subscribe|unsubscribe|listen|监听|注册|卸载|绑定|解绑)/iu.test(fn.name)) {
    return true;
  }
  return file.identifierUses.some(use => {
    return (
      use.objectId === fn.objectId &&
      use.bindingKind !== 'local' &&
      /(?:eventOn|eventOnce|addEventListener|removeEventListener|register|unregister|subscribe|unsubscribe|onMounted|onUnmounted)$/u.test(
        use.qualifiedName,
      )
    );
  });
}

function usedCapabilityCategories(file: ParsedFile, fn: FunctionFact, policy: QualityPolicy): string[] {
  const used = new Set<string>();
  for (const use of file.identifierUses) {
    if (use.objectId !== fn.objectId) {
      continue;
    }
    const capability = classifyDirectCapability(file, use, policy);
    if (capability === 'DOM_UI') {
      used.add('DOM/UI');
    } else if (capability === 'STORAGE') {
      used.add('storage');
    } else if (capability === 'NETWORK') {
      used.add('network');
    } else if (capability === 'CLOCK_RANDOM' || capability === 'SYSTEM_CLOCK') {
      used.add('clock/random');
    } else if (capability === 'TAVERN_HELPER') {
      used.add('tavern-helper');
    }
  }
  for (const imported of file.imports) {
    const owner = file.functions
      .filter(candidate => imported.line >= candidate.lineStart && imported.line <= candidate.lineEnd)
      .sort(
        (left, right) =>
          left.lineEnd - left.lineStart - (right.lineEnd - right.lineStart) ||
          right.lineStart - left.lineStart ||
          left.objectId.localeCompare(right.objectId, 'en'),
      )[0];
    if (owner?.objectId !== fn.objectId) {
      continue;
    }
    const capability = classifyImportCapability(imported);
    if (capability === 'DOM_UI') {
      used.add('DOM/UI');
    } else if (capability === 'NETWORK') {
      used.add('network');
    }
  }
  return [...used].sort();
}

function findModuleComment(file: ParsedFile): CommentFact | undefined {
  const body = (file.internal.ast as { body?: Array<{ range?: [number, number] }> } | undefined)?.body ?? [];
  const firstNodeStart = body.find(node => node.range)?.range?.[0] ?? Number.POSITIVE_INFINITY;
  return file.comments
    .filter(comment => {
      return (
        comment.section === 'script' &&
        comment.attachedObjectId === undefined &&
        comment.range[1] <= firstNodeStart &&
        !isExemptComment(cleanCommentText(comment.raw))
      );
    })
    .sort((left, right) => left.range[0] - right.range[0])
    .at(0);
}

function parseJSDocTag(line: string):
  | {
      name: string;
      parameter?: string;
      description: string;
      requiresDescription: boolean;
    }
  | undefined {
  const match = /^@([A-Za-z][\w-]*)\b(.*)$/u.exec(line.trim());
  if (!match) {
    return undefined;
  }
  const rawName = match[1].toLocaleLowerCase();
  const name = rawName === 'parameter' ? 'param' : rawName;
  let rest = match[2].trim().replace(/^\{[^}]*\}\s*/u, '');
  let parameter: string | undefined;
  if (name === 'param') {
    const parameterMatch = /^\[?([A-Za-z_$][\w$]*)(?:[.=][^\]\s]+)?\]?\s*/u.exec(rest);
    if (parameterMatch) {
      parameter = parameterMatch[1];
      rest = rest.slice(parameterMatch[0].length);
    }
  }
  const description = rest.replace(/^-\s*/u, '').trim();
  return {
    name,
    parameter,
    description,
    requiresDescription: /^(?:param|returns?|throws?|deprecated)$/u.test(name),
  };
}

function referenceExists(allFiles: ParsedFile[], file: ParsedFile, reference: string): boolean {
  const normalizedReference = reference.replaceAll('\\', '/');
  const knownPaths = new Set(allFiles.map(item => posix.normalize(item.path)));
  const basenames = new Set(allFiles.map(item => posix.basename(item.path)));
  if (!normalizedReference.includes('/') && basenames.has(posix.basename(normalizedReference))) {
    return true;
  }
  const root = inferRepositoryRoot(file);
  const candidates: string[] = [];
  if (normalizedReference.startsWith('./') || normalizedReference.startsWith('../')) {
    candidates.push(normalize(join(dirname(file.absolutePath), normalizedReference)));
  } else {
    candidates.push(normalize(join(root, normalizedReference)));
    candidates.push(normalize(join(root, 'src', normalizedReference)));
    candidates.push(normalize(join(dirname(file.absolutePath), normalizedReference)));
  }
  const repositoryRelativeCandidates = candidates.map(candidate => {
    return candidate.startsWith(`${root}/`) ? candidate.slice(root.length + 1).replaceAll('\\', '/') : candidate;
  });
  return (
    repositoryRelativeCandidates.some(candidate => knownPaths.has(posix.normalize(candidate))) ||
    candidates.some(existsSync)
  );
}

function inferRepositoryRoot(file: ParsedFile): string {
  const relativeParts = file.path.replaceAll('\\', '/').split('/');
  let root = normalize(file.absolutePath);
  for (let index = 0; index < relativeParts.length; index += 1) {
    root = dirname(root);
  }
  return root;
}

function cleanCommentText(raw: string): string {
  return cleanCommentLines(raw).join(' ').replace(/\s+/gu, ' ').trim();
}

function cleanCommentLines(raw: string): string[] {
  return rawCommentContentLines(raw).map(cleanInlineMarkup);
}

function rawCommentContentLines(raw: string): string[] {
  return raw.split(/\r?\n/gu).map(line =>
    line
      .replace(/^\s*<!--\s?/u, '')
      .replace(/\s?-->\s*$/u, '')
      .replace(/^\s*\/\*+\s?/u, '')
      .replace(/\s?\*\/\s*$/u, '')
      .replace(/^\s*\/\/+\s?/u, '')
      .replace(/^\s*\*\s?/u, ''),
  );
}

function cleanInlineMarkup(line: string): string {
  if (/^\s*```/u.test(line)) {
    return line.trim();
  }
  return line
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`([^`]*)`/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeDuplicateProse(prose: string): string {
  return prose
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/giu, '')
    .replace(/@[A-Za-z][\w-]*/gu, '')
    .replace(/[^\p{Script=Han}A-Za-z]+/gu, '');
}

function countHan(value: string): number {
  return value.match(/\p{Script=Han}/gu)?.length ?? 0;
}

function containsRationale(prose: string, policy: QualityPolicy): boolean {
  return policy.comments.rationaleWords.some(word => word.length > 0 && prose.includes(word));
}

function commentFinding(
  file: ParsedFile,
  comment: CommentFact,
  ruleId: string,
  severity: 'error' | 'warning' | 'info',
  observed: number | string | boolean | null,
  limit: number | string | boolean | null,
  debt: number,
  message: string,
  suggestedFix: string,
  evidenceKey: string,
  objectId = commentObjectId(comment),
  details?: Record<string, unknown>,
): FindingSeed {
  return {
    ruleId,
    severity,
    category: 'comment',
    objectType: 'comment',
    objectId,
    path: file.path,
    line: comment.lineStart,
    column: comment.column,
    observed,
    limit,
    debt,
    message,
    suggestedFix,
    evidenceKey,
    ...(details ? { details } : {}),
  };
}

function functionCommentFinding(
  file: ParsedFile,
  fn: FunctionFact,
  ruleId: string,
  severity: 'warning',
  observed: number | string | boolean,
  limit: number | string | boolean,
  debt: number,
  message: string,
  suggestedFix: string,
  reasons: string[],
  evidenceKey = '',
): FindingSeed {
  return {
    ruleId,
    severity,
    category: 'comment',
    objectType: 'function',
    objectId: fn.objectId,
    path: file.path,
    line: fn.lineStart,
    column: 1,
    observed,
    limit,
    debt,
    message,
    suggestedFix,
    evidenceKey: `${fn.qualifiedName}:${evidenceKey || reasons.join('|')}`,
    details: { reasons },
  };
}

function typeCommentFinding(file: ParsedFile, type: TypeFact, han: number, minimum: number): FindingSeed {
  return {
    ruleId: 'COMMENT_EXPORTED_TYPE_DOC',
    severity: 'warning',
    category: 'comment',
    objectType: 'type',
    objectId: type.objectId,
    path: file.path,
    line: type.lineStart,
    column: 1,
    observed: han,
    limit: minimum,
    debt: Math.max(1, minimum - han),
    message: `导出的 ${type.kind} ${type.name} 有 ${type.memberCount} 个成员，但缺少足量中文契约说明。`,
    suggestedFix: `在声明正上方添加 JSDoc，用至少 ${minimum} 个汉字说明整体契约；成员自身只需补充不明显的约束。`,
    evidenceKey: `${type.name}:${han}`,
  };
}

function commentObjectId(comment: CommentFact): string {
  if (comment.attachedObjectId) {
    return comment.attachedObjectId;
  }
  const preceding = comment.precedingCode?.trim() ?? '';
  const following = comment.followingCode?.trim() ?? '';
  const nearbyCode =
    preceding || following
      ? `${preceding.slice(-80)} -> ${following.slice(0, 80)}`
      : cleanCommentText(comment.raw).slice(0, 120);
  return `comment:${comment.section}:${nearbyCode.slice(0, 120)}`;
}

function commentKey(file: ParsedFile, comment: CommentFact): string {
  return `${file.path}\0${comment.id}`;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10_000) / 100}%`;
}

function compareFindings(left: FindingSeed, right: FindingSeed): number {
  return (
    left.path.localeCompare(right.path, 'zh-CN') ||
    left.line - right.line ||
    left.column - right.column ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

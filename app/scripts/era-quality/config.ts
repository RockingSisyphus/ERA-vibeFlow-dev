import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { QualityPolicy } from './types.ts';

const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();
const ratio = z.number().min(0).max(1);
const chineseReason = z
  .string()
  .trim()
  .min(4)
  .refine(value => /[\u3400-\u9fff]/u.test(value), '豁免理由必须包含中文');
const relativePattern = z
  .string()
  .trim()
  .min(1)
  .refine(value => !path.isAbsolute(value), '路径和 glob 必须相对于项目根目录');
const exactRelativePath = relativePattern.refine(
  value => !['*', '?', '{', '}', '[', ']'].some(character => value.includes(character)),
  '豁免路径必须是精确文件路径，不能使用 glob',
);

const waiverSchema = z
  .object({
    ruleId: z.string().trim().min(1),
    path: exactRelativePath,
    objectId: z.string().trim().min(1),
    reason: chineseReason,
    expires: z.iso.date(),
  })
  .strict();

const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    include: z.array(relativePattern).min(1),
    thresholds: z
      .object({
        warnFileLines: positiveInteger,
        maxFileLines: positiveInteger,
        maxFileBytes: positiveInteger,
        maxFunctionsPerFile: nonNegativeInteger,
        maxClassesPerFile: nonNegativeInteger,
        maxExportsPerFile: nonNegativeInteger,
        maxFileBranches: nonNegativeInteger,
        maxDirectoryFanout: nonNegativeInteger,
        maxDirectoryFanin: nonNegativeInteger,
        maxFunctionLines: positiveInteger,
        maxFunctionBranches: nonNegativeInteger,
        maxFunctionNesting: nonNegativeInteger,
        maxFunctionParams: nonNegativeInteger,
        warnDependencyChain: positiveInteger,
        maxDependencyChain: positiveInteger,
        minDuplicateFunctionLines: positiveInteger,
      })
      .strict(),
    comments: z
      .object({
        minimumHanForUseful: positiveInteger,
        largeFileCodeLines: positiveInteger,
        minimumUsefulRatio: ratio,
        highUsefulRatio: ratio,
        moduleDocCodeLines: positiveInteger,
        moduleDocExports: positiveInteger,
        minimumModuleDocHan: positiveInteger,
        minimumCriticalDocHan: positiveInteger,
        minimumTypeDocHan: positiveInteger,
        exportedFunctionLines: positiveInteger,
        exportedFunctionBranches: nonNegativeInteger,
        criticalFunctionLines: positiveInteger,
        criticalFunctionBranches: nonNegativeInteger,
        criticalFunctionNesting: nonNegativeInteger,
        criticalFunctionParams: nonNegativeInteger,
        disabledBlockLines: positiveInteger,
        disabledBlockCodeRatio: ratio,
        duplicateProseHan: positiveInteger,
        rationaleWords: z.array(z.string().trim().min(1)).min(1),
        historyWords: z.array(z.string().trim().min(1)).min(1),
      })
      .strict(),
    architecture: z
      .object({
        forbiddenImports: z.array(
          z
            .object({
              from: relativePattern,
              to: z.array(relativePattern).min(1),
            })
            .strict(),
        ),
        purePaths: z.array(relativePattern),
        schedulerPath: relativePattern,
        schedulerClockObject: z.string().trim().min(1),
      })
      .strict(),
    capabilities: z
      .object({
        domUi: z.array(z.string().trim().min(1)),
        storage: z.array(z.string().trim().min(1)),
        network: z.array(z.string().trim().min(1)),
        clockRandom: z.array(z.string().trim().min(1)),
        allowedGlobals: z.array(z.string().trim().min(1)),
      })
      .strict(),
    waivers: z.array(waiverSchema),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.thresholds.warnFileLines > policy.thresholds.maxFileLines) {
      context.addIssue({
        code: 'custom',
        message: 'warnFileLines 不能大于 maxFileLines',
        path: ['thresholds', 'warnFileLines'],
      });
    }
    if (policy.thresholds.warnDependencyChain > policy.thresholds.maxDependencyChain) {
      context.addIssue({
        code: 'custom',
        message: 'warnDependencyChain 不能大于 maxDependencyChain',
        path: ['thresholds', 'warnDependencyChain'],
      });
    }
    if (policy.comments.minimumUsefulRatio > policy.comments.highUsefulRatio) {
      context.addIssue({
        code: 'custom',
        message: 'minimumUsefulRatio 不能大于 highUsefulRatio',
        path: ['comments', 'minimumUsefulRatio'],
      });
    }

    const waiverKeys = new Set<string>();
    policy.waivers.forEach((waiver, index) => {
      const key = `${waiver.ruleId}\0${waiver.path}\0${waiver.objectId}`;
      if (waiverKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: '同一规则、路径和对象不能重复声明豁免',
          path: ['waivers', index],
        });
      }
      waiverKeys.add(key);
    });
  });

/**
 * 从项目根目录读取并严格校验 ERA 质检策略。
 *
 * 配置刻意不提供静默默认值：CI 若丢失或拼错策略字段必须立即失败，
 * 避免质检器在不完整的规则下给出误导性的 PASS。
 */
export async function loadPolicy(root: string): Promise<QualityPolicy> {
  const configPath = path.join(path.resolve(root), 'era-quality.config.json');
  let text: string;
  try {
    text = await readFile(configPath, 'utf8');
  } catch (error) {
    throw new Error(`无法读取 ERA 质检配置 ${configPath}: ${errorMessage(error)}`, { cause: error });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`ERA 质检配置不是合法 JSON (${configPath}): ${errorMessage(error)}`, { cause: error });
  }

  const result = policySchema.safeParse(json);
  if (!result.success) {
    throw new Error(`ERA 质检配置校验失败 (${configPath}):\n${z.prettifyError(result.error)}`);
  }
  return result.data as QualityPolicy;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

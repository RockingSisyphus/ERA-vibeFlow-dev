#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';

import { addFingerprints, TOOL_VERSION } from './baseline.ts';
import { runQuality } from './engine.ts';
import { formatJson, formatText } from './report.ts';
import type { QualityReport } from './types.ts';

interface CliOptions {
  root: string;
  format: 'text' | 'json';
  useBaseline: boolean;
  writeBaseline: boolean;
  acceptPolicyChange: boolean;
  maxFindings: number;
}

async function main(): Promise<number> {
  const options = parseArguments(process.argv.slice(2));
  const result = await runQuality(options.root, {
    useBaseline: options.useBaseline,
    writeBaseline: options.writeBaseline,
    acceptPolicyChange: options.acceptPolicyChange,
  });

  process.stdout.write(
    options.format === 'json'
      ? formatJson(result.report)
      : formatText(result.report, { maxFindings: options.maxFindings }),
  );
  if (result.baselineWritten) {
    process.stderr.write('已更新 .era-quality-baseline.json。\n');
  }

  if (!options.useBaseline && !options.writeBaseline) {
    return result.report.status === 'ERROR' ? 2 : 0;
  }
  if (result.report.status === 'ERROR') {
    return 2;
  }
  if (result.report.status === 'FAIL') {
    return 1;
  }
  return 0;
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = {
    root: process.cwd(),
    format: 'text',
    useBaseline: true,
    writeBaseline: false,
    acceptPolicyChange: false,
    maxFindings: 200,
  };
  let noBaselineRequested = false;
  let writeBaselineRequested = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--format') {
      const format = args[++index];
      if (format !== 'text' && format !== 'json') {
        throw new Error('--format 只接受 text 或 json。');
      }
      options.format = format;
    } else if (argument === '--no-baseline') {
      noBaselineRequested = true;
      options.useBaseline = false;
    } else if (argument === '--write-baseline') {
      writeBaselineRequested = true;
      options.writeBaseline = true;
      options.useBaseline = true;
    } else if (argument === '--accept-policy-change') {
      options.acceptPolicyChange = true;
    } else if (argument === '--max-findings') {
      const parsed = Number(args[++index]);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('--max-findings 必须是非负整数。');
      }
      options.maxFindings = parsed;
    } else if (argument === '--root') {
      const root = args[++index];
      if (!root) {
        throw new Error('--root 缺少路径。');
      }
      options.root = path.resolve(root);
    } else if (argument === '--help' || argument === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }

  if (noBaselineRequested && writeBaselineRequested) {
    throw new Error('--no-baseline 与 --write-baseline 不能同时使用；否则可能绕过递减门禁。');
  }
  return options;
}

function printHelp(): void {
  process.stdout.write(`ERA 专用代码质量检查器

用法：
  node scripts/era-quality/cli.ts [选项]

选项：
  --format text|json        输出格式，默认 text
  --no-baseline             展示全部债务但不执行 baseline 门禁
  --write-baseline          初始化或递减更新 baseline
  --accept-policy-change    审核策略变化后迁移 baseline
  --max-findings N          文本报告最多显示 N 条 finding
  --root PATH               仓库根目录
`);
}

main()
  .then(exitCode => {
    process.exitCode = exitCode;
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    const report = fatalReport(message);
    const jsonRequested = process.argv.some(
      (argument, index, args) => argument === '--format' && args[index + 1] === 'json',
    );
    process.stdout.write(jsonRequested ? formatJson(report) : formatText(report));
    process.exitCode = 2;
  });

function fatalReport(message: string): QualityReport {
  const finding = addFingerprints([
    {
      ruleId: 'TOOL_ERROR',
      severity: 'error',
      category: 'tool',
      objectType: 'tool',
      objectId: 'era-quality',
      path: '.',
      line: 1,
      column: 1,
      observed: message,
      limit: 'successful analysis',
      debt: 1,
      message,
      suggestedFix: '修复配置、源码解析或质检器内部错误后重新运行；此错误不能写入 baseline。',
    },
  ])[0];
  return {
    schemaVersion: 1,
    tool: { name: 'era-quality', version: TOOL_VERSION, policyDigest: '' },
    status: 'ERROR',
    root: process.cwd().replaceAll('\\', '/'),
    summary: {
      files: 0,
      errors: 1,
      warnings: 0,
      infos: 0,
      baselineKnown: 0,
      newFindings: 0,
      worsenedFindings: 0,
      improvedFindings: 0,
      resolvedFindings: 0,
    },
    metrics: {
      files: 0,
      comments: {
        total: 0,
        naturalLanguage: 0,
        chinese: 0,
        usefulChineseLines: 0,
        scriptCodeLines: 0,
      },
      dependencyGraph: {
        runtime: {},
        typeOnly: {},
        longestRuntimeChain: [],
        cycles: [],
        directoryFanIn: {},
        directoryFanOut: {},
      },
    },
    findings: [finding],
    baselineDiff: {
      known: 0,
      new: 0,
      worsened: 0,
      improved: 0,
      resolved: 0,
      waived: 0,
      resolvedEntries: [],
    },
  };
}

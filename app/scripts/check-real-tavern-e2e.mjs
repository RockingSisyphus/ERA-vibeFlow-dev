/// <reference types="node" />

import { readFile } from 'node:fs/promises';

const reportUrl = new URL('../../reports/e2e/real-tavern-summary.json', import.meta.url);
const report = JSON.parse(await readFile(reportUrl, 'utf8'));
const expectedMethods = ['commit', 'get', 'subscribe', 'sync', 'history.atMessage'];
const receipts = Array.isArray(report.facade?.commitReceipts) ? report.facade.commitReceipts : [];

const passed =
  report.status === 'PASS' &&
  JSON.stringify(report.facade?.methods) === JSON.stringify(expectedMethods) &&
  receipts.length >= 3 &&
  receipts.every(
    (receipt) =>
      (receipt?.status === 'committed' || receipt?.status === 'skipped') &&
      ['message', 'branch', 'always'].includes(receipt?.scope),
  ) &&
  report.facade?.legacyPublicEventListenerCount === 0 &&
  report.facade?.mixedScopeTransactionCount === 0 &&
  report.sidecar?.stateSource === 'user-file' &&
  report.sidecar?.chatVariablesContainOnlyPointer === true &&
  report.macro?.hook === 'generate_after_data' &&
  typeof report.macro?.output === 'string' &&
  !report.macro.output.includes('{{ERA:');

process.stdout.write(`${JSON.stringify({ status: passed ? 'PASS' : 'FAIL', report: reportUrl.pathname }, null, 2)}\n`);
if (!passed) process.exitCode = 1;

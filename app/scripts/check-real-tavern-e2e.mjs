/// <reference types="node" />

import { readFile } from 'node:fs/promises';

const reportUrl = new URL('../../reports/e2e/real-tavern-summary.json', import.meta.url);
const report = JSON.parse(await readFile(reportUrl, 'utf8'));
const expectedInputs = [
  'era:insertByObject',
  'era:updateByObject',
  'era:insertByPath',
  'era:updateByPath',
  'era:deleteByPath',
  'era:deleteByObject',
  'era:getCurrentVars',
  'era:getSnapshotAtMk',
  'era:getSnapshotsBetweenMks',
  'era:getSnapshotAtMId',
  'era:getSnapshotsBetweenMIds',
  'era:requestWriteDone',
  'era:forceSync',
];

const passed =
  report.status === 'PASS' &&
  JSON.stringify(report.inputs) === JSON.stringify(expectedInputs) &&
  report.outputCounts?.['era:apiWrite'] === 6 &&
  report.outputCounts?.['era:writeDone'] === 8 &&
  report.outputCounts?.['era:queryResult'] === 5 &&
  report.macro?.hook === 'generate_after_data' &&
  typeof report.macro?.output === 'string' &&
  !report.macro.output.includes('{{ERA:');

process.stdout.write(`${JSON.stringify({ status: passed ? 'PASS' : 'FAIL', report: reportUrl.pathname }, null, 2)}\n`);
if (!passed) process.exitCode = 1;

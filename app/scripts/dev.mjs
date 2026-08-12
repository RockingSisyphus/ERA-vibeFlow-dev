/* eslint-disable import-x/no-nodejs-modules */
import { spawn } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = new Map();
let stopping = false;
let finalExitCode = 0;

function start(name, script) {
  const child = spawn(pnpmCommand, ['run', script], {
    env: process.env,
    stdio: 'inherit',
  });

  children.set(name, child);
  child.on('error', error => {
    console.error(`[era:dev] 无法启动 ${name}:`, error);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(name);

    if (!stopping) {
      const reason = signal ? `信号 ${signal}` : `退出码 ${code ?? 1}`;
      console.error(`[era:dev] ${name} 已意外退出（${reason}），正在停止其他开发服务。`);
      shutdown(code ?? 1);
      return;
    }

    if (children.size === 0) {
      process.exit(finalExitCode);
    }
  });
}

function shutdown(exitCode = 0, signal = 'SIGTERM') {
  if (stopping) {
    return;
  }

  stopping = true;
  finalExitCode = exitCode;
  for (const child of children.values()) {
    if (!child.killed) {
      child.kill(signal);
    }
  }

  if (children.size === 0) {
    process.exit(finalExitCode);
  }

  setTimeout(() => {
    for (const child of children.values()) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }
    process.exit(finalExitCode);
  }, 3000).unref();
}

console.info('[era:dev] 启动静态文件服务与酒馆助手热更新监听；按 Ctrl+C 可同时停止。');
start('静态文件服务', 'serve');
start('webpack 监听', 'watch');

process.on('SIGINT', () => shutdown(0, 'SIGINT'));
process.on('SIGTERM', () => shutdown(0, 'SIGTERM'));

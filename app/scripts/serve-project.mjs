/* eslint-disable import-x/no-nodejs-modules */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const host = process.env.ERA_STATIC_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.ERA_STATIC_PORT ?? '5500', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`ERA_STATIC_PORT 必须是 1 到 65535 之间的整数，当前值为 ${process.env.ERA_STATIC_PORT}`);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.scss', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
]);

function setCommonHeaders(response) {
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');
}

function sendText(response, statusCode, message) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(message);
}

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', `http://${host}:${port}`).pathname);
  if (pathname.includes('\0')) {
    return undefined;
  }

  const requestedPath = resolve(projectRoot, `.${pathname}`);
  if (requestedPath !== projectRoot && !requestedPath.startsWith(`${projectRoot}${sep}`)) {
    return undefined;
  }
  return requestedPath;
}

const server = createServer(async (request, response) => {
  setCommonHeaders(response);

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed');
    return;
  }

  let requestedPath;
  try {
    requestedPath = resolveRequestPath(request.url);
  } catch {
    sendText(response, 400, 'Bad Request');
    return;
  }

  if (!requestedPath) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const requestedStat = await stat(requestedPath);
    if (requestedStat.isDirectory()) {
      requestedPath = resolve(requestedPath, 'index.html');
      if (!(await stat(requestedPath)).isFile()) {
        sendText(response, 404, 'Not Found');
        return;
      }
    } else if (!requestedStat.isFile()) {
      sendText(response, 404, 'Not Found');
      return;
    }

    const fileStat = await stat(requestedPath);
    response.statusCode = 200;
    response.setHeader('Content-Length', fileStat.size);
    response.setHeader(
      'Content-Type',
      contentTypes.get(extname(requestedPath).toLowerCase()) ?? 'application/octet-stream',
    );

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(requestedPath)
      .on('error', error => {
        console.error('[era:serve] 读取文件失败:', error);
        if (!response.headersSent) {
          sendText(response, 500, 'Internal Server Error');
        } else {
          response.destroy(error);
        }
      })
      .pipe(response);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      sendText(response, 404, 'Not Found');
      return;
    }
    console.error('[era:serve] 请求处理失败:', error);
    sendText(response, 500, 'Internal Server Error');
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[era:serve] ${host}:${port} 已被占用；请停止 VS Code Live Server 或设置 ERA_STATIC_PORT。`);
  } else {
    console.error('[era:serve] 静态服务器启动失败:', error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.info(`[era:serve] 正在通过 http://${host}:${port} 提供项目文件`);
  console.info(`[era:serve] 项目根目录: ${projectRoot}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exitCode = 0;
    });
  });
}

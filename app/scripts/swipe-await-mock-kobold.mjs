/* eslint-disable import-x/no-nodejs-modules */
import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.ERA_SWIPE_AWAIT_MOCK_PORT ?? '19001', 10);
const maxBodyBytes = 2 * 1024 * 1024;

if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8000) {
  throw new Error(`ERA_SWIPE_AWAIT_MOCK_PORT 必须是 1024–65535 且不能为 8000，当前值为 ${port}`);
}

let generationRequests = [];

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBodyBytes) {
      throw new Error(`请求体超过 ${maxBodyBytes} bytes`);
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return text.length === 0 ? {} : JSON.parse(text);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (request.method === 'GET' && url.pathname === '/api/v1/info/version') {
    sendJson(response, 200, { result: '1.2.4' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/extra/version') {
    sendJson(response, 200, { result: 'KoboldCpp', version: '1.45' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/model') {
    sendJson(response, 200, { result: 'era-swipe-await-mock' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/probe') {
    sendJson(response, 200, {
      generationRequests,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/reset') {
    generationRequests = [];
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/generate') {
    try {
      const body = await readJsonBody(request);
      const record = {
        sequence: generationRequests.length + 1,
        epochMs: Date.now(),
        iso: new Date().toISOString(),
        path: url.pathname,
        promptLength: typeof body.prompt === 'string' ? body.prompt.length : null,
      };
      generationRequests.push(record);
      console.info('[SwipeAwaitMock] generation-request', record);

      sendJson(response, 200, {
        results: [
          {
            text: 'Swipe Promise mock reply.',
          },
        ],
      });
    } catch (error) {
      sendJson(response, 400, { error: String(error) });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not Found' });
});

server.on('error', error => {
  console.error('[SwipeAwaitMock] server error', error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.info(`[SwipeAwaitMock] listening on http://${host}:${port}`);
  console.info(`[SwipeAwaitMock] configure KoboldAI as http://${host}:${port}/api`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exitCode = 0;
    });
  });
}

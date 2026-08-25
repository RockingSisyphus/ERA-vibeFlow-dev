import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { info, init } from '../server-plugin/index.mjs';

class TestRouter {
    handlers = new Map();

    get(route, handler) {
        this.handlers.set(`GET ${route}`, handler);
    }

    post(route, handler) {
        this.handlers.set(`POST ${route}`, handler);
    }
}

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        },
    };
}

async function invoke(router, method, route, request) {
    const handler = router.handlers.get(`${method} ${route}`);
    assert.ok(handler, `Missing ${method} ${route} handler.`);
    const response = createResponse();
    await handler(request, response);
    return response;
}

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'era-sidecar-storage-probe-'));
const user = name => ({ user: { directories: { extensions: path.join(sandbox, name, 'extensions') } } });

try {
    assert.equal(info.id, 'era-sidecar-storage-probe');
    const router = new TestRouter();
    await init(router);

    const health = await invoke(router, 'GET', '/health', user('alice'));
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.storageScope, 'current-user/extensions/era-sidecar-storage-probe');

    const payload = { nested: { counter: 3 }, list: ['one', 'two'] };
    const write = await invoke(router, 'POST', '/write', { ...user('alice'), body: { key: 'chat_123', data: payload } });
    assert.equal(write.statusCode, 200);
    assert.equal(write.body.ok, true);

    const read = await invoke(router, 'POST', '/read', { ...user('alice'), body: { key: 'chat_123' } });
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.body.record.data, payload);

    const otherUserRead = await invoke(router, 'POST', '/read', { ...user('bob'), body: { key: 'chat_123' } });
    assert.equal(otherUserRead.statusCode, 404);

    const traversal = await invoke(router, 'POST', '/write', { ...user('alice'), body: { key: '../escape', data: payload } });
    assert.equal(traversal.statusCode, 400);

    const tooLarge = await invoke(router, 'POST', '/write', { ...user('alice'), body: { key: 'too-large', data: 'x'.repeat(64 * 1024 + 1) } });
    assert.equal(tooLarge.statusCode, 400);

    const removed = await invoke(router, 'POST', '/delete', { ...user('alice'), body: { key: 'chat_123' } });
    assert.equal(removed.statusCode, 200);
    const missing = await invoke(router, 'POST', '/read', { ...user('alice'), body: { key: 'chat_123' } });
    assert.equal(missing.statusCode, 404);

    console.log(`ERA sidecar storage probe contract passed on ${process.platform} (${process.version}).`);
} finally {
    await fs.rm(sandbox, { recursive: true, force: true });
}

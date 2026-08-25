(() => {
    'use strict';

    const BASE_URL = '/api/plugins/era-sidecar-storage-probe';

    async function request(path, body) {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            credentials: 'same-origin',
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({ ok: false, error: 'The plugin returned non-JSON data.' }));
        if (!response.ok || result.ok !== true) {
            throw new Error(result.error ?? `Sidecar probe request failed: ${response.status}`);
        }
        return result;
    }

    async function runSelfTest() {
        const key = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        const payload = { token, purpose: 'ERA sidecar storage probe', createdAt: new Date().toISOString() };

        const health = await request('/health');
        await request('/write', { key, data: payload });
        const read = await request('/read', { key });
        await request('/delete', { key });

        if (JSON.stringify(read.record.data) !== JSON.stringify(payload)) {
            throw new Error('Read-back payload differs from the written payload.');
        }
        return { ok: true, key, health, record: read.record };
    }

    globalThis.ERA_SIDECAR_STORAGE_PROBE = Object.freeze({
        health: () => request('/health'),
        read: key => request('/read', { key }),
        write: (key, data) => request('/write', { key, data }),
        delete: key => request('/delete', { key }),
        runSelfTest,
    });
})();

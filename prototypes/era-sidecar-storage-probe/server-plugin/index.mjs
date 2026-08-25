import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const info = {
    id: 'era-sidecar-storage-probe',
    name: 'ERA Sidecar Storage Probe',
    description: 'A constrained per-user file-storage probe for ERA sidecar research.',
};

const STORE_DIRECTORY = 'era-sidecar-storage-probe';
const MAX_JSON_BYTES = 64 * 1024;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function clientError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function getStoreRoot(request) {
    const extensionsDirectory = request?.user?.directories?.extensions;
    if (typeof extensionsDirectory !== 'string' || extensionsDirectory.length === 0) {
        const error = new Error('Authenticated SillyTavern user storage is unavailable.');
        error.statusCode = 500;
        throw error;
    }

    return path.resolve(extensionsDirectory, STORE_DIRECTORY);
}

function validateKey(key) {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
        throw clientError('key must be 1-64 ASCII letters, digits, underscores, or hyphens.');
    }
    return key;
}

function getRecordPath(storeRoot, key) {
    const recordPath = path.resolve(storeRoot, `${key}.json`);
    if (path.dirname(recordPath) !== storeRoot) {
        throw clientError('Invalid key.');
    }
    return recordPath;
}

function normalizeData(data) {
    if (data === undefined) {
        throw clientError('data is required.');
    }

    let serialized;
    try {
        serialized = JSON.stringify(data);
    } catch {
        throw clientError('data must be JSON-serializable.');
    }

    if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) {
        throw clientError(`data must be JSON-serializable and at most ${MAX_JSON_BYTES} bytes.`);
    }

    return JSON.parse(serialized);
}

async function writeAtomically(recordPath, content) {
    const temporaryPath = path.join(
        path.dirname(recordPath),
        `.${path.basename(recordPath)}.${crypto.randomUUID()}.tmp`,
    );

    try {
        await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        await fs.rename(temporaryPath, recordPath);
    } catch (error) {
        await fs.unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

function sendError(response, error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) {
        console.error('[era-sidecar-storage-probe]', error);
    }
    return response.status(statusCode).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
}

export async function init(router) {
    router.get('/health', async (request, response) => {
        try {
            const storeRoot = getStoreRoot(request);
            await fs.mkdir(storeRoot, { recursive: true, mode: 0o700 });
            return response.json({
                ok: true,
                schemaVersion: 1,
                storageScope: `current-user/extensions/${STORE_DIRECTORY}`,
                platform: process.platform,
                node: process.version,
            });
        } catch (error) {
            return sendError(response, error);
        }
    });

    router.post('/write', async (request, response) => {
        try {
            const key = validateKey(request.body?.key);
            const data = normalizeData(request.body?.data);
            const storeRoot = getStoreRoot(request);
            await fs.mkdir(storeRoot, { recursive: true, mode: 0o700 });

            const record = {
                schemaVersion: 1,
                key,
                writtenAt: new Date().toISOString(),
                data,
            };
            const content = `${JSON.stringify(record)}\n`;
            await writeAtomically(getRecordPath(storeRoot, key), content);

            return response.json({ ok: true, key, bytes: Buffer.byteLength(content, 'utf8'), writtenAt: record.writtenAt });
        } catch (error) {
            return sendError(response, error);
        }
    });

    router.post('/read', async (request, response) => {
        try {
            const key = validateKey(request.body?.key);
            const recordPath = getRecordPath(getStoreRoot(request), key);
            let content;
            try {
                content = await fs.readFile(recordPath, 'utf8');
            } catch (error) {
                if (error?.code === 'ENOENT') {
                    return response.status(404).json({ ok: false, error: 'Record not found.' });
                }
                throw error;
            }

            const record = JSON.parse(content);
            if (record?.schemaVersion !== 1 || record?.key !== key || !Object.hasOwn(record, 'data')) {
                const error = new Error('Stored record does not match the probe schema.');
                error.statusCode = 500;
                throw error;
            }
            return response.json({ ok: true, record });
        } catch (error) {
            return sendError(response, error);
        }
    });

    router.post('/delete', async (request, response) => {
        try {
            const key = validateKey(request.body?.key);
            const recordPath = getRecordPath(getStoreRoot(request), key);
            await fs.unlink(recordPath).catch(error => {
                if (error?.code !== 'ENOENT') throw error;
            });
            return response.json({ ok: true, key });
        } catch (error) {
            return sendError(response, error);
        }
    });
}

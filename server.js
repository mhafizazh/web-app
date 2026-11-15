'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

// In-memory store for events received from the watch (latest wins for same key).
// Each entry is the normalized payload transferred by the watch.
const watchEvents = new Map();

function readJsonBody(req, maxBytes = 1024 * 64) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeWatchEvent(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const tag = String(p.tag || (p.feeling === 'lifted' ? 'good' : p.feeling === 'drained' ? 'bad' : 'unsafe'));
  const feeling = String(p.feeling || (tag === 'good' ? 'lifted' : tag === 'bad' ? 'drained' : 'unsafe'));
  const receivedAt = Number(p.receivedAt) || Date.now();
  const rawTime = Number(p.time || 0);
  const rawTs = Number(p.ts || 0);
  const plausibleTimestamp = (value) => Number.isFinite(value) && value > 0 &&
    Math.abs(value - receivedAt) <= 7 * 24 * 60 * 60 * 1000;
  // Monkey C Number is 32-bit; multiplying epoch seconds by 1000 on-device can
  // overflow. Prefer a plausible ms timestamp, otherwise derive it server-side
  // from epoch seconds, then fall back to receipt time for a badly skewed clock.
  const ts = plausibleTimestamp(rawTs) ? rawTs
    : plausibleTimestamp(rawTime * 1000) ? rawTime * 1000
      : receivedAt;

  // Normalize to canonical fields. Unsafe data must be transferred accurately.
  const normalized = {
    feeling,
    tag,
    reason: p.reason == null ? null : String(p.reason),
    shared: tag === 'unsafe' ? Boolean(p.shared) : false,
    lat: typeof p.lat === 'number' ? p.lat : (p.lat == null ? null : Number(p.lat)),
    lon: typeof p.lon === 'number' ? p.lon : (p.lon == null ? null : Number(p.lon)),
    time: Number.isFinite(rawTime) && rawTime > 0 ? rawTime : Math.floor(ts / 1000),
    ts,
    deviceId: p.deviceId ? String(p.deviceId) : 'fenix7pro',
    deviceTime: p.deviceTime ? String(p.deviceTime) : null,
    receivedAt,
  };

  // For lifted/drained, force non-unsafe semantics.
  if (tag === 'good' || tag === 'bad') {
    normalized.shared = false;
    normalized.reason = null;
  }
  // For unsafe, keep exact shared/reason as provided (already coerced).
  if (tag === 'unsafe') {
    normalized.feeling = 'unsafe';
  }

  return normalized;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendJson(res, 404, { ok: false, error: 'Not found' });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      // SPA-style fallback for client routes (no file extension).
      if (!path.extname(relativePath)) {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(indexPath, (indexError, indexData) => {
          if (indexError) {
            sendJson(res, 404, { ok: false, error: 'Not found' });
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(indexData);
        });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type':
        MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, app: 'eve-web' });
      return;
    }

    // Receive watch input events (I'm lifted / I'm drained / I'm unsafe).
    if (pathname === '/api/watch-events') {
      if (req.method === 'POST') {
        const payload = await readJsonBody(req);
        const event = normalizeWatchEvent(payload);
        // Key by time+tag so final unsafe state (e.g. shared/reason update) replaces earlier record.
        const key = `${event.time}:${event.tag}:${event.feeling}`;
        watchEvents.set(key, event);
        console.log('[watch-event]', event.feeling, event.tag, event.shared, event.reason);
        sendJson(res, 200, { ok: true, event });
        return;
      }
      if (req.method === 'GET') {
        // Repair previously stored events too, so a stale/overflowed timestamp
        // in server memory doesn't keep the UI's date-filtered totals stale.
        const events = Array.from(watchEvents.entries()).map(([key, event]) => {
          const normalized = normalizeWatchEvent(event);
          watchEvents.set(key, normalized);
          return normalized;
        }).sort((a, b) => a.ts - b.ts);
        sendJson(res, 200, { ok: true, events });
        return;
      }
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    // Backward-compatible endpoint name.
    if (req.method === 'POST' && pathname === '/api/events') {
      const payload = await readJsonBody(req);
      // Map legacy choice yes/no if ever sent.
      let event = null;
      if (payload && payload.choice) {
        const c = String(payload.choice).toLowerCase();
        event = normalizeWatchEvent({
          feeling: c === 'yes' ? 'lifted' : c === 'no' ? 'unsafe' : 'drained',
          tag: c === 'yes' ? 'good' : c === 'no' ? 'unsafe' : 'bad',
          shared: false,
          reason: null,
          time: Math.floor(Number(payload.ts || Date.now()) / 1000),
          ts: Number(payload.ts || Date.now()),
          deviceId: payload.deviceId || 'fenix7pro',
          deviceTime: payload.deviceTime || null,
        });
      } else {
        event = normalizeWatchEvent(payload);
      }
      const key = `${event.time}:${event.tag}:${event.feeling}`;
      watchEvents.set(key, event);
      sendJson(res, 200, { ok: true, event });
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, pathname);
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[server]', error);
    if (!res.headersSent) {
      const msg = error && error.message ? error.message : 'Internal server error';
      const code = msg === 'Payload too large' ? 413 : msg === 'Invalid JSON' ? 400 : 500;
      sendJson(res, code, { ok: false, error: msg });
    } else {
      res.end();
    }
  }
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other server or run with PORT=3001 npm start.`,
    );
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`Eve web app: http://localhost:${PORT}`);
});

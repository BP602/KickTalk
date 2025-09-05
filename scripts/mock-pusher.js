// Lightweight mock Pusher-like WebSocket server for local testing
// Usage: node scripts/mock-pusher.js
// Optionally set PORT (default 8081)

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const send = (ws, obj) => {
  try { ws.send(JSON.stringify(obj)); } catch {}
};
const reply = (ws, event, channel, dataObj) => {
  send(ws, { event, channel, data: JSON.stringify(dataObj || {}) });
};

wss.on('connection', (ws) => {
  // Connection established frame expected by client
  send(ws, {
    event: 'pusher:connection_established',
    data: JSON.stringify({ socket_id: '123.456', activity_timeout: 120 })
  });

  const subs = new Set();

  ws.on('message', (msg) => {
    let json = null;
    try { json = JSON.parse(msg); } catch {}
    if (!json) return;
    if (json.event === 'pusher:subscribe') {
      const ch = json?.data?.channel;
      if (ch) {
        subs.add(ch);
        reply(ws, 'pusher_internal:subscription_succeeded', ch, {});
      }
    }
  });

  // Periodically emit demo events for subscribed channels
  const tick = () => {
    for (const ch of subs) {
      if (ch.startsWith('channel.')) {
        // Toggle live on/off
        reply(ws, 'App\\Events\\StreamerIsLive', ch, { livestream: { is_live: true, session_title: 'Demo Live' } });
        setTimeout(() => reply(ws, 'App\\Events\\StopStreamBroadcast', ch, { livestream: { is_live: false } }), 4000);
      }
      if (ch.startsWith('chatrooms.') && ch.endsWith('.v2')) {
        // Minimal chat event example (adjust as needed by your UI)
        reply(ws, 'App\\Events\\MessageSentEvent', ch, {
          message: {
            id: `${Date.now()}`,
            content: 'hello world',
            sender: { id: 'u1', username: 'demo' }
          }
        });
      }
    }
  };
  const timer = setInterval(tick, 9000);

  ws.on('close', () => clearInterval(timer));
});

server.listen(PORT, () => {
  console.log(`[mock-pusher] listening on ws://localhost:${PORT}`);
  console.log('Set RENDERER_VITE_KT_PUSHER_URL=ws://localhost:' + PORT + ' for the renderer build.');
});


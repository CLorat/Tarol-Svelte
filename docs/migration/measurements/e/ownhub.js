// minimal SignalR JSON-protocol client over WebSocket: negotiate, handshake, invoke, ping, reconnect with backoff
const RS = '\u001e';
export function hub(url, token, onMsg) {
  let ws, id = 0, pending = new Map(), subs = new Set(), attempt = 0, closed = false, ping;
  async function connect() {
    const t = await token();
    const neg = await fetch(url + '/negotiate?negotiateVersion=1', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).then((r) => r.json());
    const u = new URL(url, location.href); u.protocol = u.protocol.replace('http', 'ws');
    u.searchParams.set('id', neg.connectionToken); u.searchParams.set('access_token', t);
    ws = new WebSocket(u);
    ws.onopen = () => { ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS); };
    let hs = false;
    ws.onmessage = (e) => {
      for (const f of String(e.data).split(RS)) {
        if (!f) continue; const m = JSON.parse(f);
        if (!hs) { hs = true; attempt = 0; ping = setInterval(() => ws.send('{"type":6}' + RS), 15000); for (const s of subs) invoke('Subscribe', s); continue; }
        if (m.type === 1) onMsg(m.target, m.arguments);
        else if (m.type === 3) { const p = pending.get(m.invocationId); pending.delete(m.invocationId); m.error ? p?.[1](new Error(m.error)) : p?.[0](m.result); }
        else if (m.type === 7) ws.close();
      }
    };
    ws.onclose = () => { clearInterval(ping); for (const [, p] of pending) p[1](new Error('closed')); pending.clear(); if (!closed) setTimeout(connect, Math.min(30000, 500 * 2 ** attempt++)); };
  }
  function invoke(target, ...args) {
    return new Promise((res, rej) => { const i = String(++id); pending.set(i, [res, rej]); ws.send(JSON.stringify({ type: 1, invocationId: i, target, arguments: args }) + RS); });
  }
  connect();
  return { subscribe(s) { subs.add(s); return invoke('Subscribe', s); }, close() { closed = true; ws?.close(); } };
}
hub('/tarol/messages', async () => 't', console.log).subscribe('orders');

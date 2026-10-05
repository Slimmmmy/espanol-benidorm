// Отправка напоминаний (GitHub Actions, каждые 30 минут). Конфигурация — секрет PUSH_CONFIG,
// который приложение показывает на экране «Напоминания». Подписка и время берутся из Supabase.
import webpush from 'web-push';
import { parsePushConfig, shouldSend, summarize, buildMessage, localParts } from './remind-core.mjs';

const raw = process.env.PUSH_CONFIG;
if (!raw) { console.log('PUSH_CONFIG не задан — напоминания выключены.'); process.exit(0); }
const cfg = parsePushConfig(raw);
const force = (process.env.FORCE || '').trim(); // ручной запуск: test | morning | evening
const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' };

async function getRow(code) {
  const res = await fetch(`${cfg.url}/rest/v1/sync?code=eq.${encodeURIComponent(code)}&select=data`, { headers });
  if (!res.ok) throw new Error(`Supabase: чтение ${code} — ${res.status}`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}

async function putRow(code, data) {
  const res = await fetch(`${cfg.url}/rest/v1/sync`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ code, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase: запись ${code} — ${res.status}`);
}

const push = await getRow(`${cfg.code}:push`);
if (!push || !push.subscription) { console.log('Подписки нет — включите уведомления в приложении.'); process.exit(0); }
const state = (await getRow(`${cfg.code}:push-state`)) || {};
const now = Date.now();
const kinds = force ? [force] : ['morning', 'evening'].filter((k) => shouldSend(k, push, state, now));
if (!kinds.length) { console.log('Сейчас слать нечего.'); process.exit(0); }

const snap = (await getRow(cfg.code)) || {};
const summary = summarize(snap, now, push.tz);
webpush.setVapidDetails(cfg.subject || 'https://slimmmmy.github.io/espanol-benidorm/', cfg.vapid.publicKey, cfg.vapid.privateKey);
const { date } = localParts(now, push.tz);
const dayIndex = Math.floor(now / 86400000);

for (const kind of kinds) {
  const msg = buildMessage(kind, summary, dayIndex);
  if (msg) {
    try {
      await webpush.sendNotification(push.subscription, JSON.stringify(msg), { TTL: 4 * 3600, urgency: 'normal' });
      console.log(`Отправлено (${kind}): ${msg.title}`);
    } catch (e) {
      console.log(`Ошибка отправки (${kind}): ${e.statusCode || ''} ${e.body || e.message}`);
      if (e.statusCode === 404 || e.statusCode === 410) state.expired = date;
      else process.exitCode = 1;
      continue;
    }
  } else {
    console.log(`Пропущено (${kind}): сегодня уже занимались.`);
  }
  if (kind !== 'test') state[`last_${kind}`] = date;
  state.lastSent = new Date(now).toISOString();
  state.lastKind = kind;
}
await putRow(`${cfg.code}:push-state`, state);

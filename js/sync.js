import { getSetting, setSetting, exportAll, getAllMistakes, replaceWordsPreservingIds, bulkReplaceMistakes, ensureWordUids } from './db.js';
import { mergeSnapshots } from './merge.js';

const SECRET_KEYS = ['apiKey', 'supabaseUrl', 'supabaseKey', 'syncCode', 'googleTtsKey', 'vapid', 'pushEndpoint'];

export async function getSyncConfig() {
  return {
    url: ((await getSetting('supabaseUrl')) || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, ''),
    key: (await getSetting('supabaseKey')) || '',
    code: (await getSetting('syncCode')) || '',
  };
}

export async function pullRemote(cfg) {
  let res;
  try {
    res = await fetch(`${cfg.url}/rest/v1/sync?code=eq.${encodeURIComponent(cfg.code)}&select=data`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
  } catch (e) {
    throw new Error('Нет сети — синхронизация недоступна.');
  }
  if (!res.ok) throw new Error(`Ошибка чтения из облака (${res.status}). Проверь URL и ключ.`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}

export async function pushRemote(cfg, data) {
  const res = await fetch(`${cfg.url}/rest/v1/sync`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ code: cfg.code, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Ошибка записи в облако (${res.status}).`);
}

export async function localSnapshot() {
  await ensureWordUids();
  const { settings, words } = await exportAll();
  const mistakes = await getAllMistakes();
  const clean = {};
  for (const [k, v] of Object.entries(settings || {})) {
    if (!SECRET_KEYS.includes(k)) clean[k] = v;
  }
  return { words, mistakes, settings: clean };
}

export async function applySnapshot(snap) {
  await replaceWordsPreservingIds(snap.words || []);
  await bulkReplaceMistakes(snap.mistakes || []);
  for (const [k, v] of Object.entries(snap.settings || {})) {
    if (!SECRET_KEYS.includes(k)) await setSetting(k, v);
  }
}

export async function syncNow() {
  const cfg = await getSyncConfig();
  if (!cfg.url || !cfg.key || !cfg.code) {
    throw new Error('Заполни Supabase URL, ключ и код синхронизации в Настройках.');
  }
  const remote = await pullRemote(cfg);
  const local = await localSnapshot();
  const merged = remote ? mergeSnapshots(local, remote) : local;
  await applySnapshot(merged);
  // Если в облаке уже ровно то же самое — не перезаписываем (экономит трафик и не трогает updated_at).
  if (!remote || stableJson(merged) !== stableJson(remote)) await pushRemote(cfg, merged);
  return merged;
}

// JSON с отсортированными ключами — для сравнения снимков независимо от порядка полей.
export function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v === undefined ? null : v);
}

// Фоновая синхронизация без гонок: одновременно идёт не больше одной; вызовы во время работы
// схлопываются в один повтор после её окончания.
let running = null;
let again = null;

async function runAuto() {
  try {
    const cfg = await getSyncConfig();
    if (cfg.url && cfg.key && cfg.code) await syncNow();
  } catch (e) {
    // тихо: офлайн или не настроено — приложение работает локально
  }
}

export function autoSync() {
  if (!running) {
    running = runAuto().finally(() => { running = null; });
    return running;
  }
  if (!again) {
    again = running.then(() => { again = null; return autoSync(); });
  }
  return again;
}

// Отдельные строки таблицы sync (например, «код:push» — подписка на напоминания). Пусто — null.
export async function getRow(cfg, code) {
  let res;
  try {
    res = await fetch(`${cfg.url}/rest/v1/sync?code=eq.${encodeURIComponent(code)}&select=data`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
  } catch (e) { throw new Error('Нет сети.'); }
  if (!res.ok) throw new Error(`Ошибка чтения из облака (${res.status}).`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}

export async function putRow(cfg, code, data) {
  await pushRemote({ ...cfg, code }, data);
}

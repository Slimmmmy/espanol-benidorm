import { getSetting, setSetting, exportAll, getAllMistakes, bulkReplaceWords, bulkReplaceMistakes } from './db.js';
import { mergeSnapshots } from './merge.js';

const SECRET_KEYS = ['apiKey', 'supabaseUrl', 'supabaseKey', 'syncCode'];

export async function getSyncConfig() {
  return {
    url: ((await getSetting('supabaseUrl')) || '').replace(/\/+$/, ''),
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
  const { settings, words } = await exportAll();
  const mistakes = await getAllMistakes();
  const clean = {};
  for (const [k, v] of Object.entries(settings || {})) {
    if (!SECRET_KEYS.includes(k)) clean[k] = v;
  }
  return { words, mistakes, settings: clean };
}

export async function applySnapshot(snap) {
  await bulkReplaceWords(snap.words || []);
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
  await pushRemote(cfg, merged);
  return merged;
}

export async function autoSync() {
  try {
    const cfg = await getSyncConfig();
    if (cfg.url && cfg.key && cfg.code) await syncNow();
  } catch (e) {
    // тихо: офлайн или не настроено — приложение работает локально
  }
}

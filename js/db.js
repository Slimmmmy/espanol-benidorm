// Обёртка IndexedDB с версионированной схемой и миграциями.
import { wordKey, isVocab } from './wordkey.js';
const DB_NAME = 'espanol';
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // Миграции по возрастанию версии. Новые версии добавляют свои блоки.
      if (e.oldVersion < 1) {
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
      }
      if (e.oldVersion < 2) {
        db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSetting(key) {
  const db = await openDB();
  const row = await asPromise(tx(db, 'settings', 'readonly').get(key));
  return row ? row.value : undefined;
}

export async function setSetting(key, value) {
  const db = await openDB();
  await asPromise(tx(db, 'settings', 'readwrite').put({ key, value }));
}

// Постоянный идентификатор слова: не меняется при синхронизации (в отличие от числового id базы).
export function newUid() {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Сохранение слова пользователем: проставляет uid и время изменения (по нему решается, какая версия свежее).
export async function putWord(word) {
  const db = await openDB();
  const w = { ...word, uid: word.uid || newUid(), updatedAt: Date.now() };
  return asPromise(tx(db, 'words', 'readwrite').put(w));
}

// Одноразовая миграция: старым словам без uid выдаём uid, не трогая время изменения.
export async function ensureWordUids() {
  const db = await openDB();
  const words = await asPromise(tx(db, 'words', 'readonly').getAll());
  const missing = words.filter((w) => !w.uid);
  if (!missing.length) return 0;
  const t = db.transaction('words', 'readwrite');
  for (const w of missing) t.objectStore('words').put({ ...w, uid: newUid() });
  await done(t);
  return missing.length;
}

export async function getAllWords() {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readonly').getAll());
}

// Только слова словаря — без карточек тренажёров (глаголы, исправление ошибок).
export async function getVocab() {
  return (await getAllWords()).filter(isVocab);
}

export async function exportAll() {
  const db = await openDB();
  const words = await asPromise(tx(db, 'words', 'readonly').getAll());
  const settingsRows = await asPromise(tx(db, 'settings', 'readonly').getAll());
  const settings = {};
  for (const row of settingsRows) settings[row.key] = row.value;
  return { settings, words };
}

export async function importAll(data) {
  const db = await openDB();
  for (const [key, value] of Object.entries(data.settings || {})) {
    await asPromise(tx(db, 'settings', 'readwrite').put({ key, value }));
  }
  for (const word of data.words || []) {
    await asPromise(tx(db, 'words', 'readwrite').put(word));
  }
}

export async function getWord(id) {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readonly').get(id));
}

// Удаление оставляет пометку (tombstone), чтобы синхронизация не вернула слово с другого устройства.
export async function deleteWord(id) {
  const db = await openDB();
  const w = await asPromise(tx(db, 'words', 'readonly').get(id));
  await asPromise(tx(db, 'words', 'readwrite').delete(id));
  if (w && w.es) await addTombstone(wordKey(w), w.uid);
}

// key — ключ карточки (wordKey).
export async function addTombstone(key, uid = '', at = Date.now()) {
  const list = (await getSetting('deletedWords')) || [];
  list.push({ key: String(key).trim().toLowerCase(), uid: uid || '', at });
  await setSetting('deletedWords', list.slice(-500));
}

export async function addMistake(m) {
  const db = await openDB();
  return asPromise(tx(db, 'mistakes', 'readwrite').add(m));
}

export async function getAllMistakes() {
  const db = await openDB();
  return asPromise(tx(db, 'mistakes', 'readonly').getAll());
}

function done(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// Применить объединённый словарь, сохранив числовые id существующих слов (сопоставление по uid или по слову).
// Открытые экраны продолжают ссылаться на те же id — дублей не появляется.
export async function replaceWordsPreservingIds(words) {
  const db = await openDB();
  const existing = await asPromise(tx(db, 'words', 'readonly').getAll());
  const key = wordKey;
  const byUid = new Map(existing.filter((w) => w.uid).map((w) => [w.uid, w]));
  const byKey = new Map(existing.map((w) => [key(w), w]));
  const t = db.transaction('words', 'readwrite');
  const store = t.objectStore('words');
  const kept = new Set();
  for (const w of words || []) {
    const { id, ...rest } = w;
    const match = (rest.uid && byUid.get(rest.uid)) || byKey.get(key(rest));
    if (match && !kept.has(match.id)) {
      kept.add(match.id);
      store.put({ ...rest, id: match.id });
    } else {
      store.add(rest);
    }
  }
  for (const w of existing) if (!kept.has(w.id)) store.delete(w.id);
  await done(t);
}

export async function bulkReplaceWords(words) {
  const db = await openDB();
  const t = db.transaction('words', 'readwrite');
  const store = t.objectStore('words');
  store.clear();
  for (const w of words || []) {
    const { id, ...rest } = w;
    store.add(rest);
  }
  await new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function bulkReplaceMistakes(items) {
  const db = await openDB();
  const t = db.transaction('mistakes', 'readwrite');
  const store = t.objectStore('mistakes');
  store.clear();
  for (const m of items || []) {
    const { id, ...rest } = m;
    store.add(rest);
  }
  await new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

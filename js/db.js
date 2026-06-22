// Обёртка IndexedDB с версионированной схемой и миграциями.
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

export async function putWord(word) {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readwrite').put(word));
}

export async function getAllWords() {
  const db = await openDB();
  return asPromise(tx(db, 'words', 'readonly').getAll());
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

export async function deleteWord(id) {
  const db = await openDB();
  await asPromise(tx(db, 'words', 'readwrite').delete(id));
}

export async function addMistake(m) {
  const db = await openDB();
  return asPromise(tx(db, 'mistakes', 'readwrite').add(m));
}

export async function getAllMistakes() {
  const db = await openDB();
  return asPromise(tx(db, 'mistakes', 'readonly').getAll());
}

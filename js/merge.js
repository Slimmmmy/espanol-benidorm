// Слияние снимков данных между устройствами. Чистые функции, без побочных эффектов.
import { mergeActivity } from './activity.js';
import { mergeInbox } from './capture.js';
import { wordKey } from './wordkey.js';

function normEs(s) { return String(s || '').trim().toLowerCase(); }

function freshness(w) { return [w.reps || 0, w.due || 0, w.createdAt || 0]; }

// Свежее та версия, что изменена позже (updatedAt); без него — по последнему повтору (FSRS),
// а для старых карточек — по числу повторов.
function fresher(a, b) {
  if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if ((a.lastReview || 0) !== (b.lastReview || 0)) return (a.lastReview || 0) > (b.lastReview || 0) ? a : b;
  return fresherLegacy(a, b);
}

function fresherLegacy(a, b) {
  const fa = freshness(a), fb = freshness(b);
  for (let i = 0; i < fa.length; i++) {
    if (fa[i] !== fb[i]) return fa[i] > fb[i] ? a : b;
  }
  return a;
}

// Пометки об удалении: слово, удалённое позже последнего изменения, не возвращается с другого устройства.
function deletedAt(tombstones) {
  const m = new Map();
  for (const t of tombstones || []) {
    if (!t || !t.key) continue;
    m.set(t.key, Math.max(m.get(t.key) || 0, t.at || 0));
  }
  return m;
}

export function mergeWords(a, b, tombstones) {
  const map = new Map();
  for (const w of [...(a || []), ...(b || [])]) {
    if (!normEs(w.es)) continue;
    const k = wordKey(w);
    const { id, ...rest } = w;
    if (map.has(k)) {
      const prev = map.get(k);
      const win = fresher(prev, rest);
      map.set(k, { ...win, uid: win.uid || prev.uid || rest.uid });
    } else {
      map.set(k, rest);
    }
  }
  const dead = deletedAt(tombstones);
  return [...map.entries()]
    .filter(([k, w]) => !(dead.has(k) && dead.get(k) >= (w.updatedAt || w.createdAt || 0)))
    .map(([, w]) => w);
}

export function mergeTombstones(a, b) {
  const m = new Map();
  for (const t of [...(a || []), ...(b || [])]) {
    if (!t || !t.key) continue;
    const prev = m.get(t.key);
    if (!prev || (t.at || 0) > (prev.at || 0)) m.set(t.key, t);
  }
  return [...m.values()].sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-500);
}

export function mergeMistakes(a, b) {
  const map = new Map();
  for (const m of [...(a || []), ...(b || [])]) {
    const { id, ...rest } = m;
    const k = `${rest.phrase}|${rest.createdAt}`;
    if (!map.has(k)) map.set(k, rest);
  }
  return [...map.values()];
}

function mergeStudyDays(a, b) {
  return [...new Set([...(a || []), ...(b || [])])].sort();
}

function mergeLessonHistory(a, b) {
  const map = new Map();
  for (const e of [...(a || []), ...(b || [])]) {
    const k = `${e.topic}|${e.date}`;
    if (!map.has(k)) map.set(k, e);
  }
  return [...map.values()].sort((x, y) => (x.date || 0) - (y.date || 0));
}

function addedCount(set) { return ((set && set.words) || []).filter((w) => w.added).length; }

// Чат: объединяем сообщения с обоих устройств (дедуп по ts|role|content), сортируем по времени.
function mergeChatHistory(a, b) {
  const map = new Map();
  for (const m of [...(a || []), ...(b || [])]) {
    const k = `${m.ts || 0}|${m.role}|${m.content}`;
    if (!map.has(k)) map.set(k, m);
  }
  return [...map.values()].sort((x, y) => (x.ts || 0) - (y.ts || 0)).slice(-80);
}

// Задания: объединяем по id; при конфликте берём выполненное (в нём проверка/разбор), иначе позже обновлённое.
function mergeAssignments(a, b) {
  const map = new Map();
  for (const t of [...(a || []), ...(b || [])]) {
    const prev = map.get(t.id);
    if (!prev) { map.set(t.id, t); continue; }
    if (t.status === 'done' && prev.status !== 'done') map.set(t.id, t);
    else if (t.status === 'done' && prev.status === 'done') {
      if ((t.doneAt || 0) > (prev.doneAt || 0)) map.set(t.id, t);
    }
  }
  return [...map.values()].sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
}

// Курс: берём версию с большим числом пройденных юнитов (чтобы не терять прогресс).
function doneUnits(c) { return ((c && c.units) || []).filter((u) => u.status === 'done').length; }
function mergeCourse(a, b) {
  if (!a) return b;
  if (!b) return a;
  return doneUnits(a) >= doneUnits(b) ? a : b;
}

function mergeMemory(a, b) {
  const seen = new Set();
  const out = [];
  for (const n of [...(a || []), ...(b || [])]) {
    const k = String(n).trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out.slice(-50);
}

function mergeRoleplay(a, b) {
  const map = new Map();
  for (const r of [...(a || []), ...(b || [])]) {
    const k = `${r.scene}|${r.date}`;
    if (!map.has(k)) map.set(k, r);
  }
  return [...map.values()].sort((x, y) => (x.date || 0) - (y.date || 0)).slice(-100);
}

// Страницы книги: объединяем по id; при конфликте берём ту, где больше вопросов-ответов.
export function mergeReaderPages(a, b) {
  const map = new Map();
  for (const p of [...(a || []), ...(b || [])]) {
    const prev = map.get(p.id);
    if (!prev || ((p.qa || []).length > (prev.qa || []).length)) map.set(p.id, p);
  }
  return [...map.values()].sort((x, y) => (x.date || 0) - (y.date || 0)).slice(-30);
}

// Истории: по id; при конфликте — та, где уже ответили на вопрос.
export function mergeStories(a, b) {
  const map = new Map();
  for (const s of [...(a || []), ...(b || [])]) {
    const prev = map.get(s.id);
    if (!prev || (prev.answered == null && s.answered != null)) map.set(s.id, s);
  }
  return [...map.values()].sort((x, y) => (x.date || 0) - (y.date || 0)).slice(-20);
}

export function mergeSettings(a, b) {
  const A = a || {}, B = b || {};
  const out = { ...B, ...A };
  out.studyDays = mergeStudyDays(A.studyDays, B.studyDays);
  out.lessonHistory = mergeLessonHistory(A.lessonHistory, B.lessonHistory);
  if (A.chatHistory || B.chatHistory) out.chatHistory = mergeChatHistory(A.chatHistory, B.chatHistory);
  if (A.assignments || B.assignments) out.assignments = mergeAssignments(A.assignments, B.assignments);
  if (A.course || B.course) out.course = mergeCourse(A.course, B.course);
  if (A.tutorMemory || B.tutorMemory) out.tutorMemory = mergeMemory(A.tutorMemory, B.tutorMemory);
  const ta = A.teacherProfile, tb = B.teacherProfile;
  if (ta || tb) {
    out.teacherProfile = ((ta && ta.updatedAt) || 0) >= ((tb && tb.updatedAt) || 0) ? (ta || tb) : (tb || ta);
  }
  if (A.roleplayHistory || B.roleplayHistory) out.roleplayHistory = mergeRoleplay(A.roleplayHistory, B.roleplayHistory);
  if (A.readerPages || B.readerPages) out.readerPages = mergeReaderPages(A.readerPages, B.readerPages);
  if (A.inbox || B.inbox) out.inbox = mergeInbox(A.inbox, B.inbox);
  if (A.stories || B.stories) out.stories = mergeStories(A.stories, B.stories);
  if (A.deletedWords || B.deletedWords) out.deletedWords = mergeTombstones(A.deletedWords, B.deletedWords);
  for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (key.startsWith('activity-')) out[key] = mergeActivity(A[key], B[key]);
    if (key.startsWith('daily-')) {
      const da = A[key], db = B[key];
      out[key] = (da && db) ? (addedCount(da) >= addedCount(db) ? da : db) : (da || db);
    }
  }
  return out;
}

export function mergeSnapshots(local, remote) {
  const settings = mergeSettings((local || {}).settings, (remote || {}).settings);
  return {
    words: mergeWords((local || {}).words, (remote || {}).words, settings.deletedWords),
    mistakes: mergeMistakes((local || {}).mistakes, (remote || {}).mistakes),
    settings,
  };
}

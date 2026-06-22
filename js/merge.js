// Слияние снимков данных между устройствами. Чистые функции, без побочных эффектов.

function normEs(s) { return String(s || '').trim().toLowerCase(); }

function freshness(w) { return [w.reps || 0, w.due || 0, w.createdAt || 0]; }

function fresher(a, b) {
  const fa = freshness(a), fb = freshness(b);
  for (let i = 0; i < fa.length; i++) {
    if (fa[i] !== fb[i]) return fa[i] > fb[i] ? a : b;
  }
  return a;
}

export function mergeWords(a, b) {
  const map = new Map();
  for (const w of [...(a || []), ...(b || [])]) {
    const k = normEs(w.es);
    if (!k) continue;
    const { id, ...rest } = w;
    map.set(k, map.has(k) ? fresher(map.get(k), rest) : rest);
  }
  return [...map.values()];
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

export function mergeSettings(a, b) {
  const A = a || {}, B = b || {};
  const out = { ...B, ...A };
  out.studyDays = mergeStudyDays(A.studyDays, B.studyDays);
  out.lessonHistory = mergeLessonHistory(A.lessonHistory, B.lessonHistory);
  const ta = A.teacherProfile, tb = B.teacherProfile;
  if (ta || tb) {
    out.teacherProfile = ((ta && ta.updatedAt) || 0) >= ((tb && tb.updatedAt) || 0) ? (ta || tb) : (tb || ta);
  }
  for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (key.startsWith('daily-')) {
      const da = A[key], db = B[key];
      out[key] = (da && db) ? (addedCount(da) >= addedCount(db) ? da : db) : (da || db);
    }
  }
  return out;
}

export function mergeSnapshots(local, remote) {
  return {
    words: mergeWords((local || {}).words, (remote || {}).words),
    mistakes: mergeMistakes((local || {}).mistakes, (remote || {}).mistakes),
    settings: mergeSettings((local || {}).settings, (remote || {}).settings),
  };
}

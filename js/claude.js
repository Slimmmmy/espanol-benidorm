import { getSetting } from './db.js';
import { extractJson, recentMessages } from './util.js';
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM, DAILY_WORDS_SYSTEM, LESSON_GEN_SYSTEM, LESSON_REVIEW_SYSTEM, COURSE_GEN_SYSTEM, CHAT_TUTOR_SYSTEM, ASSIGNMENT_GEN_SYSTEM, ASSIGNMENT_CHECK_SYSTEM, MEMORY_EXTRACT_SYSTEM, VOICE_COACH_HINT, ROLEPLAY_SYSTEM, ROLEPLAY_DEBRIEF_SYSTEM, READER_SYSTEM, READER_QA_SYSTEM, CAPTURE_SYSTEM, LESSON_VERIFY_SYSTEM } from './prompts.js';
import * as S from './schemas.js';

export const DEFAULT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_CHAT_MODEL = 'claude-sonnet-5-5';
export const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — быстрая и дешёвая' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — умнее, живее в разговоре' },
];
// Устаревшие id из прошлых версий приложения → актуальная замена.
const LEGACY_MODELS = { 'claude-sonnet-4-6': 'claude-sonnet-5-5' };
export const resolveModel = (id, fallback) => LEGACY_MODELS[id] || id || fallback;

const API_URL = 'https://api.anthropic.com/v1/messages';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Тело запроса к Messages API. Чистая функция.
// Sonnet 5.5 по умолчанию «думает» — для коротких учебных ответов выключаем размышления
// (between_tools без инструментов = без размышлений) и ставим низкое усилие: быстрее и дешевле.
// cache: автоматический кэш промпта — выгоден в многоходовых разговорах (чат, сценки).
// schema: JSON-схема ответа (structured outputs) — модель гарантированно вернёт JSON этой формы.
export function buildRequest({ model, system, messages, maxTokens, cache = false, minimal = false, schema = null }) {
  const body = { model, max_tokens: maxTokens, system, messages };
  const headers = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (cache) body.cache_control = { type: 'ephemeral' };
  if (!minimal && model.startsWith('claude-sonnet-5-5')) {
    body.thinking = { type: 'between_tools' };
    body.output_config = { effort: 'low' };
    body.fallbacks = 'default';
    headers['anthropic-beta'] = FALLBACK_BETA;
  }
  if (!minimal && schema) body.output_config = { ...(body.output_config || {}), format: { type: 'json_schema', schema } };
  return { headers, body };
}

async function post(apiKey, req) {
  try {
    return await fetch(API_URL, {
      method: 'POST',
      headers: { ...req.headers, 'x-api-key': apiKey },
      body: JSON.stringify(req.body),
    });
  } catch (e) {
    throw new Error('Нет сети. AI-функции недоступны офлайн.');
  }
}

// tier: 'fast' — короткие задачи (словарь, проверки); 'chat' — разговор, сценки, уроки.
export async function callClaude({ system, messages, model, maxTokens = 1024, tier = 'fast', cache = false, schema = null }) {
  const apiKey = await getSetting('apiKey');
  if (!apiKey) {
    throw new Error('Не задан API-ключ. Откройте Настройки и вставьте ключ.');
  }
  const fast = resolveModel(await getSetting('model'), DEFAULT_MODEL);
  const chosenModel = model || (tier === 'chat' ? resolveModel(await getSetting('chatModel'), DEFAULT_CHAT_MODEL) : fast);

  let req = buildRequest({ model: chosenModel, system, messages, maxTokens, cache, schema });
  let res = await post(apiKey, req);
  // Если дополнительные параметры (бета, схема) не приняты — повторяем простым запросом;
  // промпт всё равно просит JSON, а extractJson его разберёт.
  if (res.status === 400 && (req.body.thinking || req.body.output_config)) {
    req = buildRequest({ model: chosenModel, system, messages, maxTokens, cache, minimal: true });
    res = await post(apiKey, req);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}
    if (res.status === 401) throw new Error('Неверный API-ключ. Проверьте Настройки.');
    if (res.status === 429) throw new Error('Превышен лимит запросов. Попробуйте позже.');
    if (res.status === 404) throw new Error(`Модель ${chosenModel} недоступна для вашего ключа. Выберите другую в Настройках.`);
    throw new Error(`Ошибка API (${res.status}). ${detail}`);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Модель отказалась отвечать на этот запрос. Переформулируйте, пожалуйста.');
  const block = (data.content || []).find((b) => b.type === 'text');
  return block ? block.text : '';
}

export async function testConnection() {
  try {
    const text = await callClaude({
      messages: [{ role: 'user', content: 'Responde solo con la palabra: OK' }],
      maxTokens: 16,
    });
    return { ok: true, message: `Связь есть. Ответ: ${text.trim()}` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export async function enrichWord(input) {
  const text = await callClaude({
    system: WORD_ENRICH_SYSTEM,
    schema: S.WORD_ENRICH,
    messages: [{ role: 'user', content: input }],
    maxTokens: 400,
  });
  return extractJson(text);
}

export async function generateDialogue(topic, level = 'A2-B1') {
  const text = await callClaude({
    system: DIALOGUE_SYSTEM,
    schema: S.DIALOGUE,
    messages: [{ role: 'user', content: `Тема: ${topic}. Уровень: ${level}.` }],
    maxTokens: 900,
  });
  return extractJson(text);
}

export async function checkGrammar(text) {
  const out = await callClaude({
    system: GRAMMAR_SYSTEM,
    schema: S.GRAMMAR,
    messages: [{ role: 'user', content: text }],
    maxTokens: 500,
  });
  return extractJson(out);
}

export async function gradeSpeech(target, heard) {
  const text = await callClaude({
    system: SPEECH_COACH_SYSTEM,
    schema: S.SPEECH_COACH,
    messages: [{ role: 'user', content: `Эталон: ${target}\nРаспозналось: ${heard}` }],
    maxTokens: 500,
  });
  return extractJson(text);
}

export async function generateDailyWords(knownEs = []) {
  const known = knownEs.slice(0, 200).join(', ');
  const text = await callClaude({
    system: DAILY_WORDS_SYSTEM,
    schema: S.DAILY_WORDS,
    messages: [{ role: 'user', content: `Слова, которые ученик уже знает (не повторяй их): ${known || '(пока пусто)'}` }],
    maxTokens: 800,
  });
  return extractJson(text);
}

export async function generateLesson(profile, topic) {
  const text = await callClaude({
    system: LESSON_GEN_SYSTEM,
    schema: S.LESSON_GEN,
    tier: 'chat',
    messages: [{ role: 'user', content: `Профиль ученика: ${JSON.stringify(profile)}\nТема урока: ${topic}` }],
    maxTokens: 1200,
  });
  const lesson = normalizeLesson(extractJson(text));
  try {
    return applyLessonCheck(lesson, await verifyLesson(lesson));
  } catch (e) {
    return lesson; // проверка — подстраховка: если не удалась, показываем урок как есть
  }
}

// Приводит упражнения к единому виду: у «choice» — варианты и индекс, у «open» — эталон.
export function normalizeLesson(lesson) {
  const exercises = ((lesson && lesson.exercises) || []).map((ex) => {
    const options = Array.isArray(ex.options) ? ex.options : [];
    const type = ex.type === 'choice' && options.length >= 2 ? 'choice' : 'open';
    const out = { type, prompt: ex.prompt || '' };
    if (type === 'choice') {
      out.options = options;
      out.answer = Number.isInteger(ex.answer) && ex.answer >= 0 && ex.answer < options.length ? ex.answer : 0;
    } else {
      out.expected = ex.expected || (options[ex.answer] ?? '');
    }
    return out;
  }).filter((ex) => ex.prompt);
  return { ...lesson, exercises };
}

// Независимая проверка ключей: вторая модель решает упражнения сама и сверяет с эталоном.
export async function verifyLesson(lesson) {
  const items = lesson.exercises.map((ex, i) => ({
    n: i + 1, type: ex.type, prompt: ex.prompt,
    ...(ex.type === 'choice' ? { options: ex.options, answer: ex.answer } : { expected: ex.expected }),
  }));
  const text = await callClaude({
    system: LESSON_VERIFY_SYSTEM,
    schema: S.LESSON_VERIFY,
    tier: 'chat',
    messages: [{ role: 'user', content: `Тема: ${lesson.topic}\nУпражнения: ${JSON.stringify(items)}` }],
    maxTokens: 900,
  });
  return extractJson(text);
}

// Применяет исправления проверки. Чистая функция.
export function applyLessonCheck(lesson, check) {
  const res = (check && check.exercises) || [];
  const exercises = lesson.exercises.map((ex, i) => {
    const r = res[i];
    if (!r || r.ok) return ex;
    if (ex.type === 'choice' && Number.isInteger(r.answer) && r.answer >= 0 && r.answer < ex.options.length) {
      return { ...ex, answer: r.answer, fixed: true };
    }
    if (ex.type === 'open' && r.expected && r.expected.trim()) return { ...ex, expected: r.expected.trim(), fixed: true };
    return ex;
  });
  return { ...lesson, exercises };
}

export async function reviewLesson(lesson, answers) {
  const items = (lesson.exercises || []).map((ex, i) => ({
    prompt: ex.prompt,
    expected: ex.type === 'choice' ? (ex.options || [])[ex.answer] : ex.expected,
    answer: answers[i] || '',
  }));
  const text = await callClaude({
    system: LESSON_REVIEW_SYSTEM,
    schema: S.LESSON_REVIEW,
    tier: 'chat',
    messages: [{ role: 'user', content: `Тема: ${lesson.topic}\nУпражнения и ответы ученика: ${JSON.stringify(items)}` }],
    maxTokens: 900,
  });
  return extractJson(text);
}

export async function generateCourse(profile, goal) {
  const text = await callClaude({
    system: COURSE_GEN_SYSTEM,
    schema: S.COURSE_GEN,
    tier: 'chat',
    messages: [{ role: 'user', content: `Профиль ученика: ${JSON.stringify(profile)}\nЦель: ${goal}` }],
    maxTokens: 1100,
  });
  return extractJson(text);
}

// Профиль передаётся «снимком» на всю беседу, а подсказка про голос — в последнем сообщении,
// чтобы начало запроса не менялось от реплики к реплике и работал кэш промпта.
export async function chatReply(history, profile, opts = {}) {
  const messages = recentMessages(history, 30, 10);
  if (opts && opts.voice && messages.length) {
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = { role: last.role, content: `${last.content}\n\n(${VOICE_COACH_HINT})` };
  }
  const system = `${CHAT_TUTOR_SYSTEM}\nПрофиль ученика: ${JSON.stringify(profile)}`;
  return callClaude({ system, messages, maxTokens: 700, tier: 'chat', cache: true });
}

export async function generateAssignment(profile, topic) {
  const text = await callClaude({
    system: ASSIGNMENT_GEN_SYSTEM,
    schema: S.ASSIGNMENT_GEN,
    messages: [{ role: 'user', content: `Профиль ученика: ${JSON.stringify(profile)}\nТема (если задана): ${topic || '(на твой выбор по слабым местам)'}` }],
    maxTokens: 400,
  });
  return extractJson(text);
}

export async function checkAssignment(task, answer) {
  const text = await callClaude({
    system: ASSIGNMENT_CHECK_SYSTEM,
    schema: S.ASSIGNMENT_CHECK,
    messages: [{ role: 'user', content: `Задание: ${task}\nОтвет ученика: ${answer}` }],
    maxTokens: 500,
  });
  return extractJson(text);
}

export async function extractMemory(existingNotes, userMsg, assistantMsg, knownTopics = []) {
  const text = await callClaude({
    system: MEMORY_EXTRACT_SYSTEM,
    schema: S.MEMORY_EXTRACT,
    messages: [{ role: 'user', content: `Текущие заметки: ${JSON.stringify(existingNotes || [])}\nИзвестные темы ошибок ученика: ${JSON.stringify(knownTopics)}\nУченик: ${userMsg || ''}\nПреподаватель: ${assistantMsg || ''}` }],
    maxTokens: 400,
  });
  return extractJson(text);
}

export const ROLEPLAY_START = '(Начни сцену своей первой репликой.)';

function sceneBrief(scene) {
  return `Сцена: ${scene.title}\nТвоя роль: ${scene.role}\nОбстановка: ${scene.setting}\nЦель ученика: ${scene.goal}`;
}

export async function roleplayReply(scene, history) {
  const messages = recentMessages([{ role: 'user', content: ROLEPLAY_START }, ...(history || [])], 40, 10);
  const text = await callClaude({
    system: `${ROLEPLAY_SYSTEM}\n\n${sceneBrief(scene)}`,
    schema: S.ROLEPLAY,
    messages,
    maxTokens: 500,
    tier: 'chat',
    cache: true,
  });
  return extractJson(text);
}

export async function debriefRoleplay(scene, transcript) {
  const text = await callClaude({
    system: ROLEPLAY_DEBRIEF_SYSTEM,
    schema: S.ROLEPLAY_DEBRIEF,
    messages: [{ role: 'user', content: `${sceneBrief(scene)}\n\nСтенограмма:\n${transcript}` }],
    maxTokens: 1200,
    tier: 'chat',
  });
  return extractJson(text);
}

// Фото страницы книги → текст, перевод, смысл, слова, грамматика.
export function buildReaderMessages(imageB64, knownEs = [], book = '') {
  const known = knownEs.slice(0, 300).join(', ');
  return [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } },
      { type: 'text', text: `${book ? `Книга: ${book}\n` : ''}Слова, которые ученик уже знает (не включай их в "words"): ${known || '(пока пусто)'}` },
    ],
  }];
}

export async function readBookPage(imageB64, knownEs, book) {
  const text = await callClaude({
    system: READER_SYSTEM,
    schema: S.READER,
    messages: buildReaderMessages(imageB64, knownEs, book),
    maxTokens: 6000,
    tier: 'chat',
  });
  return extractJson(text);
}

export async function askAboutPage(pageText, history) {
  return callClaude({
    system: `${READER_QA_SYSTEM}\n\nТекст страницы:\n${pageText}`,
    messages: recentMessages(history, 20),
    maxTokens: 700,
    tier: 'chat',
    cache: true,
  });
}

// Слово «как услышал» → 1–3 варианта испанского слова.
export async function resolveHeardWord(raw, context = '') {
  const text = await callClaude({
    system: CAPTURE_SYSTEM,
    schema: S.CAPTURE,
    messages: [{ role: 'user', content: `Записал так: ${raw}${context ? `\nГде услышал: ${context}` : ''}` }],
    maxTokens: 700,
  });
  return extractJson(text);
}

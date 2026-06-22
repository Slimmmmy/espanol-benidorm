import { getSetting } from './db.js';
import { extractJson } from './util.js';
import { WORD_ENRICH_SYSTEM, DIALOGUE_SYSTEM, GRAMMAR_SYSTEM, SPEECH_COACH_SYSTEM, DAILY_WORDS_SYSTEM, LESSON_GEN_SYSTEM, LESSON_REVIEW_SYSTEM } from './prompts.js';

export const DEFAULT_MODEL = 'claude-haiku-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export async function callClaude({ system, messages, model, maxTokens = 1024 }) {
  const apiKey = await getSetting('apiKey');
  if (!apiKey) {
    throw new Error('Не задан API-ключ. Откройте Настройки и вставьте ключ.');
  }
  const chosenModel = model || (await getSetting('model')) || DEFAULT_MODEL;

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });
  } catch (e) {
    throw new Error('Нет сети. AI-функции недоступны офлайн.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}
    if (res.status === 401) throw new Error('Неверный API-ключ. Проверьте Настройки.');
    if (res.status === 429) throw new Error('Превышен лимит запросов. Попробуйте позже.');
    throw new Error(`Ошибка API (${res.status}). ${detail}`);
  }

  const data = await res.json();
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
    messages: [{ role: 'user', content: input }],
    maxTokens: 400,
  });
  return extractJson(text);
}

export async function generateDialogue(topic, level = 'A2-B1') {
  const text = await callClaude({
    system: DIALOGUE_SYSTEM,
    messages: [{ role: 'user', content: `Тема: ${topic}. Уровень: ${level}.` }],
    maxTokens: 900,
  });
  return extractJson(text);
}

export async function checkGrammar(text) {
  const out = await callClaude({
    system: GRAMMAR_SYSTEM,
    messages: [{ role: 'user', content: text }],
    maxTokens: 500,
  });
  return extractJson(out);
}

export async function gradeSpeech(target, heard) {
  const text = await callClaude({
    system: SPEECH_COACH_SYSTEM,
    messages: [{ role: 'user', content: `Эталон: ${target}\nРаспозналось: ${heard}` }],
    maxTokens: 500,
  });
  return extractJson(text);
}

export async function generateDailyWords(knownEs = []) {
  const known = knownEs.slice(0, 200).join(', ');
  const text = await callClaude({
    system: DAILY_WORDS_SYSTEM,
    messages: [{ role: 'user', content: `Слова, которые ученик уже знает (не повторяй их): ${known || '(пока пусто)'}` }],
    maxTokens: 800,
  });
  return extractJson(text);
}

export async function generateLesson(profile, topic) {
  const text = await callClaude({
    system: LESSON_GEN_SYSTEM,
    messages: [{ role: 'user', content: `Профиль ученика: ${JSON.stringify(profile)}\nТема урока: ${topic}` }],
    maxTokens: 1200,
  });
  return extractJson(text);
}

export async function reviewLesson(lesson, answers) {
  const items = (lesson.exercises || []).map((ex, i) => ({
    prompt: ex.prompt,
    expected: ex.type === 'choice' ? (ex.options || [])[ex.answer] : ex.expected,
    answer: answers[i] || '',
  }));
  const text = await callClaude({
    system: LESSON_REVIEW_SYSTEM,
    messages: [{ role: 'user', content: `Тема: ${lesson.topic}\nУпражнения и ответы ученика: ${JSON.stringify(items)}` }],
    maxTokens: 900,
  });
  return extractJson(text);
}

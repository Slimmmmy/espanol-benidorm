// JSON-схемы ответов модели (structured outputs): API гарантирует ответ строго этой формы,
// поэтому разбор JSON больше не ломается. Каждое поле обязательно, лишних полей нет.
import { MISTAKE_TOPICS } from './curriculum.js';

const str = { type: 'string' };
const bool = { type: 'boolean' };
const int = { type: 'integer' };
const arr = (items) => ({ type: 'array', items });
// Тема ошибки — только из единого перечня (пустая строка — ошибок нет).
const topic = { type: 'string', enum: MISTAKE_TOPICS };
const topicOrNone = { type: 'string', enum: [...MISTAKE_TOPICS, ''] };

export function obj(props) {
  return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false };
}

const WORD = { es: str, ru: str, example: str, exampleRu: str, pos: str, gender: str, local: str };

export const WORD_ENRICH = obj(WORD);

export const DIALOGUE = obj({
  title: str,
  lines: arr(obj({ speaker: str, es: str, ru: str })),
  question: str,
  options: arr(str),
  answer: int,
  notes: str,
});

export const GRAMMAR = obj({ ok: bool, corrected: str, explanation: str, topic: topicOrNone });

export const SPEECH_COACH = obj({ sounds: str, rhythm: str, exercise: str });

export const DAILY_WORDS = obj({
  words: arr(obj({ es: str, ru: str, example: str, exampleRu: str, local: str })),
});

// Упражнение урока: у «choice» заполнены options/answer, у «open» — expected (остальное пустое).
const EXERCISE = obj({
  type: { type: 'string', enum: ['choice', 'open'] },
  prompt: str,
  options: arr(str),
  answer: int,
  expected: str,
});

export const LESSON_GEN = obj({ topic: str, explanation: str, exercises: arr(EXERCISE) });

export const LESSON_REVIEW = obj({
  results: arr(obj({ correct: bool, comment: str })),
  summary: str,
  nextTopic: str,
  profileNote: str,
});

export const LESSON_VERIFY = obj({
  exercises: arr(obj({ ok: bool, answer: int, expected: str, note: str })),
});

export const COURSE_GEN = obj({ units: arr(obj({ title: str, topic: str })) });

export const ASSIGNMENT_GEN = obj({ text: str, topic: str });

export const ASSIGNMENT_CHECK = obj({ ok: bool, feedback: str, corrected: str, topic: topicOrNone });

export const MEMORY_EXTRACT = obj({
  notes: arr(str),
  mistakes: arr(obj({ wrong: str, right: str, topic })),
});

export const ROLEPLAY = obj({ es: str, ru: str, hint: str, end: bool });

export const ROLEPLAY_DEBRIEF = obj({
  score: int,
  goalReached: bool,
  summary: str,
  corrections: arr(obj({ wrong: str, right: str, why: str, topic })),
  newWords: arr(obj({ es: str, ru: str })),
  tip: str,
});

export const READER = obj({
  title: str,
  paragraphs: arr(str),
  translation: arr(str),
  summary: str,
  words: arr(obj({ es: str, ru: str, inText: str, example: str, exampleRu: str })),
  grammar: arr(obj({ fragment: str, explanation: str })),
  level: str,
});

export const CAPTURE = obj({ confident: bool, candidates: arr(obj(WORD)) });

export const STORY = obj({
  title: str,
  paragraphs: arr(str),
  translation: arr(str),
  newWords: arr(obj({ es: str, ru: str, example: str })),
  question: str,
  options: arr(str),
  answer: int,
});

// Учебник: теория урока — как разворот учебника (правило, почему, когда, ловушки, диалог, слова).
const EXAMPLE = obj({ es: str, ru: str, note: str });
export const TEXTBOOK_THEORY = obj({
  intro: str,
  sections: arr(obj({ heading: str, text: str, examples: arr(EXAMPLE) })),
  traps: arr(obj({ wrong: str, right: str, why: str })),
  nuances: arr(str),
  dialogue: obj({ setting: str, lines: arr(obj({ speaker: str, es: str, ru: str })) }),
  words: arr(obj({ es: str, ru: str, example: str, exampleRu: str })),
  summary: arr(str),
});

// Учебник: упражнения по нарастающей; у каждого — тема (для статистики ошибок) и разбор «почему».
export const TEXTBOOK_EXERCISES = obj({
  exercises: arr(obj({
    stage: { type: 'string', enum: ['узнать', 'образовать', 'применить', 'сказать своё'] },
    type: { type: 'string', enum: ['choice', 'open'] },
    prompt: str,
    options: arr(str),
    answer: int,
    expected: str,
    why: str,
    topic,
  })),
});

export const TEXTBOOK_ASK = obj({ answer: str, examples: arr(EXAMPLE) });

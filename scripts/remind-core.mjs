// Логика напоминаний (чистые функции): когда слать, что слать. Используется GitHub Actions (scripts/remind.mjs).

// Местные дата и минуты от полуночи в часовом поясе ученика.
export function localParts(now, tz = 'Europe/Madrid') {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute) };
}

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

// Окно отправки: с выбранного времени и 3 часа после (запуски по расписанию GitHub бывают с задержкой).
export const WINDOW_MIN = 180;

export function shouldSend(kind, cfg, state, now) {
  const time = toMinutes(kind === 'morning' ? cfg.morning : cfg.evening);
  if (time === null || (kind === 'evening' && cfg.eveningOn === false)) return false;
  const { date, minutes } = localParts(now, cfg.tz);
  if ((state || {})[`last_${kind}`] === date) return false;
  return minutes >= time && minutes < time + WINDOW_MIN;
}

const DAY = 86400000;
const isNew = (w) => !w.s && !(w.reps > 0) && !w.lastReview;

function prevDay(date) {
  const d = new Date(`${date}T12:00:00Z`);
  return new Date(d.getTime() - DAY).toISOString().slice(0, 10);
}

// Сводка дня из снимка синхронизации: карточки, серия, занимался ли сегодня.
export function summarize(snap, now, tz = 'Europe/Madrid') {
  const words = (snap && snap.words) || [];
  const settings = (snap && snap.settings) || {};
  const { date } = localParts(now, tz);
  const due = words.filter((w) => !isNew(w) && (w.due ?? 0) <= now).length;
  const maxNew = Number(settings.maxNew) || 10;
  const fresh = Math.min(maxNew, words.filter(isNew).length);
  const days = new Set(settings.studyDays || []);
  let streak = 0;
  let d = days.has(date) ? date : prevDay(date);
  while (days.has(d)) { streak++; d = prevDay(d); }
  const act = settings[`activity-${date}`] || {};
  const studiedToday = days.has(date) || Object.values(act).some((v) => v > 0);
  const daily = settings[`daily-${date}`];
  const dailyLeft = daily && Array.isArray(daily.words) ? daily.words.filter((w) => !w.added).length : 5;
  return { date, due, fresh, streak, studiedToday, dailyLeft };
}

export const PHRASES = [
  ['Poco a poco se va lejos.', 'Тише едешь — дальше будешь.'],
  ['Más vale tarde que nunca.', 'Лучше поздно, чем никогда.'],
  ['¡Venga, que tú puedes!', 'Давай, у тебя получится!'],
  ['Al mal tiempo, buena cara.', 'Не унывай в трудную минуту.'],
  ['Querer es poder.', 'Где хотение, там и умение.'],
  ['Hoy es un buen día para aprender.', 'Сегодня хороший день, чтобы учиться.'],
  ['No hay mal que por bien no venga.', 'Нет худа без добра.'],
  ['Practicar hace al maestro.', 'Практика делает мастера.'],
  ['¿Un cafelito y a estudiar?', 'Кофе — и за учёбу?'],
  ['Paso a paso se llega lejos.', 'Шаг за шагом далеко уйдёшь.'],
  ['El que la sigue, la consigue.', 'Кто упорен, тот добьётся.'],
  ['¡A por ello!', 'Вперёд, за дело!'],
  ['Cada día sabes un poco más.', 'Каждый день ты знаешь чуть больше.'],
  ['De perdidos, al río.', 'Семь бед — один ответ.'],
];

const cards = (n) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'карточка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'карточки';
  return 'карточек';
};
const days = (n) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
};

// Текст уведомления. dayIndex — номер дня (для фразы дня). Возвращает null, если вечером слать незачем.
export function buildMessage(kind, s, dayIndex = 0) {
  const [es, ru] = PHRASES[((dayIndex % PHRASES.length) + PHRASES.length) % PHRASES.length];
  if (kind === 'evening') {
    if (s.studiedToday) return null;
    return {
      title: s.streak > 0 ? `Серия ${s.streak} ${days(s.streak)} под угрозой 🔥` : 'Сегодня ещё не занимались',
      body: s.due > 0 ? `${s.due} ${cards(s.due)} ждут — 5 минут повторения, и день засчитан.` : 'Пять минут: одна история или сценка — и день засчитан.',
      url: './#session',
    };
  }
  if (kind === 'test') {
    return { title: '¡Hola! Уведомления работают', body: `Утром я напишу, сколько карточек ждёт. ${es} — ${ru}`, url: './#today' };
  }
  const parts = [];
  if (s.due + s.fresh > 0) parts.push(`${s.due + s.fresh} ${cards(s.due + s.fresh)} на сегодня`);
  if (s.dailyLeft > 0) parts.push('5 новых слов');
  parts.push('занятие ~15 минут');
  const lead = s.streak > 0 ? `Серия: ${s.streak} ${days(s.streak)}. ` : '';
  return {
    title: '¡Buenos días! ☀️ Пора заниматься',
    body: `${lead}${parts.join(' · ')}.\nФраза дня: «${es}» — ${ru}`,
    url: './#session',
  };
}

// Настройки из секрета PUSH_CONFIG (его формирует приложение). Ошибка — понятным текстом.
export function parsePushConfig(raw) {
  let c;
  try { c = JSON.parse(raw); } catch (e) { throw new Error('PUSH_CONFIG: не JSON'); }
  for (const k of ['url', 'key', 'code']) if (!c[k]) throw new Error(`PUSH_CONFIG: нет поля ${k}`);
  if (!c.vapid || !c.vapid.publicKey || !c.vapid.privateKey) throw new Error('PUSH_CONFIG: нет ключей VAPID');
  return { ...c, url: String(c.url).replace(/\/+$/, '') };
}

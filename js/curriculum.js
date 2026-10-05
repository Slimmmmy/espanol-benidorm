// Грамматические темы по уровням — по мотивам Plan Curricular Института Сервантеса (A1–B2).
// Этот же перечень — единый список тем ошибок: ИИ выбирает тему только из него, поэтому статистика
// «слабых мест» не дробится на «спряжение», «форма глагола» и «времена».

export const CURRICULUM = [
  { level: 'A1', topics: [
    'Артикли (el, la, un, una)',
    'Род и число существительных',
    'Согласование прилагательных',
    'Presente: правильные глаголы',
    'Presente: неправильные глаголы',
    'ser и estar',
    'hay и está / están',
    'gustar и похожие глаголы',
    'Притяжательные (mi, tu, su)',
    'Указательные (este, ese, aquel)',
    'Вопросительные слова',
    'Числа, время и даты',
  ] },
  { level: 'A2', topics: [
    'Возвратные глаголы',
    'Pretérito perfecto',
    'Pretérito indefinido',
    'Pretérito imperfecto',
    'ir a + инфинитив',
    'estar + герундий',
    'Местоимения-дополнения (lo, la, le)',
    'Сравнения (más… que, tan… como)',
    'Предлоги (a, en, de, con…)',
    'Повелительное наклонение (tú, usted)',
    'muy и mucho',
  ] },
  { level: 'B1', topics: [
    'Indefinido или imperfecto',
    'Pluscuamperfecto',
    'Futuro simple',
    'Condicional',
    'Presente de subjuntivo',
    'por и para',
    'Относительные (que, donde, lo que)',
    'Косвенная речь',
    'Отрицательный императив',
  ] },
  { level: 'B2', topics: [
    'Imperfecto de subjuntivo',
    'Условные предложения (si…)',
    'Субхунтив после союзов (cuando, aunque, para que)',
    'Пассив и безличное se',
    'Глагольные перифразы (acabar de, volver a, llevar + gerundio)',
  ] },
];

// Темы вне уровней — лексика, порядок слов, орфография.
export const GENERAL_TOPICS = ['Выбор слова (лексика)', 'Порядок слов', 'Орфография и ударения'];

export const MISTAKE_TOPICS = [...CURRICULUM.flatMap((l) => l.topics), ...GENERAL_TOPICS];

// Уровень приложения → уровни CEFR, темы которых подходят для курса.
const APP_LEVELS = { 'A0-A1': ['A1', 'A2'], 'A2-B1': ['A2', 'B1'], 'B2+': ['B1', 'B2'] };

export function topicsForLevel(appLevel) {
  const want = APP_LEVELS[appLevel] || APP_LEVELS['A2-B1'];
  return CURRICULUM.filter((l) => want.includes(l.level));
}

export const levelOfTopic = (topic) => (CURRICULUM.find((l) => l.topics.includes(topic)) || {}).level || '';

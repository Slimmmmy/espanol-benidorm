// Фонетика под русскоязычного ученика: минимальные пары, фразы для повторения за голосом и подсказки
// по типичным ошибкам (r/rr, межзубное c/z, смягчение перед e/i, редукция безударных, мягкие b/d/g).

export const PAIR_GROUPS = [
  {
    id: 'r', title: 'r или rr', tip: 'Одиночное r между гласными — один короткий удар языком. rr и r в начале слова — раскат, 2–3 удара.',
    pairs: [['pero', 'perro'], ['caro', 'carro'], ['para', 'parra'], ['cero', 'cerro'], ['coro', 'corro'], ['foro', 'forro']],
    ru: { pero: 'но', perro: 'собака', caro: 'дорогой', carro: 'тележка', para: 'для', parra: 'виноградная лоза', cero: 'ноль', cerro: 'холм', coro: 'хор', corro: 'бегу', foro: 'форум', forro: 'подкладка' },
  },
  {
    id: 'stress', title: 'Ударение', tip: 'Ударение меняет смысл и время глагола: hablo — «говорю», habló — «он сказал».',
    pairs: [['papa', 'papá'], ['hablo', 'habló'], ['esta', 'está'], ['tomo', 'tomó'], ['termino', 'terminó'], ['practico', 'practicó']],
    ru: { papa: 'картофель (лат.-ам.), Папа Римский', 'papá': 'папа', hablo: 'я говорю', 'habló': 'он сказал', esta: 'эта', 'está': 'находится', tomo: 'я беру', 'tomó': 'он взял', termino: 'я заканчиваю', 'terminó': 'он закончил', practico: 'я тренирую', 'practicó': 'он тренировал' },
  },
  {
    id: 'theta', title: 's или c/z', tip: 'В Испании c перед e/i и z — межзубный звук, как английское th. s — обычное «с».',
    pairs: [['casa', 'caza'], ['coser', 'cocer'], ['sien', 'cien'], ['siervo', 'ciervo'], ['poso', 'pozo'], ['masa', 'maza']],
    ru: { casa: 'дом', caza: 'охота', coser: 'шить', cocer: 'варить', sien: 'висок', cien: 'сто', siervo: 'слуга', ciervo: 'олень', poso: 'осадок', pozo: 'колодец', masa: 'тесто', maza: 'булава' },
  },
  {
    id: 'ny', title: 'n или ñ', tip: 'ñ — как русское «нь» в слове «няня», n — твёрдое.',
    pairs: [['cana', 'caña'], ['pena', 'peña'], ['mono', 'moño'], ['una', 'uña']],
    ru: { cana: 'седой волос', 'caña': 'кружка пива; тростник', pena: 'жалость', 'peña': 'скала; компания друзей', mono: 'обезьяна; милый', 'moño': 'пучок волос', una: 'одна', 'uña': 'ноготь' },
  },
];

// Короткие фразы из жизни в Испании — для повторения сразу за голосом (shadowing).
export const SHADOW = [
  'Buenos días, ¿qué tal?',
  'Un café con leche, por favor.',
  'Perdona, ¿dónde está la parada del autobús?',
  '¿Cuánto cuesta esto?',
  'Vale, nos vemos mañana.',
  'Me gustaría reservar una mesa para dos.',
  'Hace mucho calor hoy, ¿verdad?',
  'Estoy buscando la farmacia.',
  'No entiendo, ¿puedes repetirlo más despacio?',
  'La cuenta, por favor.',
  'Vivo cerca de la playa de Levante.',
  'El perro de mi vecino ladra toda la noche.',
  '¿A qué hora cierra el supermercado?',
  'Quería cambiar la cita con el médico.',
  'Ayer fuimos a cenar a un restaurante muy bueno.',
  '¿Te apetece tomar algo esta tarde?',
  'Tengo que ir al ayuntamiento para el padrón.',
  'Cerca de aquí hay un mercado los miércoles.',
];

const has = (re, s) => re.test(s);

// Подсказки по фразе: на что обратить внимание русскоязычному. Чистая функция, до 3 подсказок.
export function phoneticTips(phrase) {
  const s = String(phrase || '').toLowerCase();
  const tips = [];
  if (has(/rr|(^|[\s¿¡])r|[nls]r/, s)) tips.push('rr и r в начале слова — раскатистое, 2–3 удара языком (perro, Roma).');
  else if (has(/[aeiouáéíóú]r[aeiouáéíóú]/, s)) tips.push('Одиночное r между гласными — один лёгкий удар (pero, para).');
  if (has(/z|c[eéií]/, s)) tips.push('c перед e/i и z — межзубный звук, как английское th (cerca, hacer, plaza).');
  if (has(/[td][eéií]/, s)) tips.push('t и d перед e/i не смягчайте: «te», а не «тье»; «di», а не «дьи».');
  if (has(/[aeiouáéíóú][bvdg][aeiouáéíóú]/, s)) tips.push('b, v, d, g между гласными — мягко, почти без смыкания губ или языка (cada, haber, agua).');
  if (has(/ñ/, s)) tips.push('ñ — как «нь» в слове «няня».');
  if (has(/ll|(^|\s)y[aeiou]/, s)) tips.push('ll и y — мягкое «й» (llamar, ayer).');
  if (has(/j|g[eéií]/, s)) tips.push('j и g перед e/i — глубокое «х» из горла (jamón, gente).');
  if (has(/o/, s)) tips.push('Безударное o не превращайте в «а»: «como» — «ко-мо», а не «кама».');
  return tips.slice(0, 3);
}

// Вопрос для квиза: какая пара и какое слово прозвучит. Чистая функция (rnd — для тестов).
export function pairQuestion(group, rnd = Math.random) {
  const pair = group.pairs[Math.floor(rnd() * group.pairs.length) % group.pairs.length];
  const k = rnd() < 0.5 ? 0 : 1;
  return { pair, answer: k, word: pair[k] };
}

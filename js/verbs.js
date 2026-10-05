// Спряжение испанских глаголов по правилам — без ИИ: бесплатно, мгновенно и без ошибок.
// Испанская норма: vosotros включён, pretérito perfecto — для сегодняшних событий («Hoy he comido»).

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ustedes'];
export const TENSES = [
  { id: 'presente', title: 'Presente', ru: 'настоящее', hint: 'Сейчас и обычно: «Vivo en Benidorm»' },
  { id: 'perfecto', title: 'Pretérito perfecto', ru: 'прошедшее сегодня', hint: 'Сегодня, на этой неделе, «уже»: «Hoy he comido paella»' },
  { id: 'indefinido', title: 'Pretérito indefinido', ru: 'прошедшее законченное', hint: 'Вчера, в прошлом году: «Ayer fui a la playa»' },
  { id: 'imperfecto', title: 'Pretérito imperfecto', ru: 'прошедшее длительное', hint: 'Фон и привычки в прошлом: «De niño jugaba al fútbol»' },
  { id: 'futuro', title: 'Futuro simple', ru: 'будущее', hint: '«Mañana lloverá»' },
];

// Частые глаголы. Неправильные формы — только там, где правило не работает.
export const VERBS = [
  { inf: 'ser', ru: 'быть (кем, каким)' },
  { inf: 'estar', ru: 'быть, находиться' },
  { inf: 'tener', ru: 'иметь' },
  { inf: 'hacer', ru: 'делать' },
  { inf: 'ir', ru: 'идти, ехать' },
  { inf: 'poder', ru: 'мочь' },
  { inf: 'decir', ru: 'сказать' },
  { inf: 'querer', ru: 'хотеть, любить' },
  { inf: 'saber', ru: 'знать' },
  { inf: 'venir', ru: 'приходить' },
  { inf: 'poner', ru: 'класть, ставить' },
  { inf: 'salir', ru: 'выходить' },
  { inf: 'ver', ru: 'видеть' },
  { inf: 'dar', ru: 'давать' },
  { inf: 'conocer', ru: 'знать (кого-то), быть знакомым' },
  { inf: 'hablar', ru: 'говорить' },
  { inf: 'comer', ru: 'есть' },
  { inf: 'vivir', ru: 'жить' },
  { inf: 'trabajar', ru: 'работать' },
  { inf: 'llegar', ru: 'приходить, прибывать' },
  { inf: 'pagar', ru: 'платить' },
  { inf: 'buscar', ru: 'искать' },
  { inf: 'tomar', ru: 'брать; пить' },
  { inf: 'quedar', ru: 'встречаться, договариваться' },
  { inf: 'pensar', ru: 'думать' },
  { inf: 'empezar', ru: 'начинать' },
  { inf: 'entender', ru: 'понимать' },
  { inf: 'volver', ru: 'возвращаться' },
  { inf: 'dormir', ru: 'спать' },
  { inf: 'jugar', ru: 'играть' },
  { inf: 'encontrar', ru: 'находить' },
  { inf: 'pedir', ru: 'просить, заказывать' },
  { inf: 'seguir', ru: 'продолжать; следовать' },
  { inf: 'sentir', ru: 'чувствовать' },
  { inf: 'preferir', ru: 'предпочитать' },
  { inf: 'leer', ru: 'читать' },
  { inf: 'oír', ru: 'слышать' },
  { inf: 'traer', ru: 'приносить' },
  { inf: 'conducir', ru: 'водить машину' },
  { inf: 'escribir', ru: 'писать' },
  { inf: 'abrir', ru: 'открывать' },
  { inf: 'comprar', ru: 'покупать' },
  { inf: 'beber', ru: 'пить' },
];

const P = (s) => s.split(' ');

// Полностью неправильные времена.
const TABLES = {
  presente: {
    ser: P('soy eres es somos sois son'),
    estar: P('estoy estás está estamos estáis están'),
    ir: P('voy vas va vamos vais van'),
    haber: P('he has ha hemos habéis han'),
    tener: P('tengo tienes tiene tenemos tenéis tienen'),
    venir: P('vengo vienes viene venimos venís vienen'),
    decir: P('digo dices dice decimos decís dicen'),
    oír: P('oigo oyes oye oímos oís oyen'),
    dar: P('doy das da damos dais dan'),
    saber: P('sé sabes sabe sabemos sabéis saben'),
    ver: P('veo ves ve vemos veis ven'),
    seguir: P('sigo sigues sigue seguimos seguís siguen'),
  },
  indefinido: {
    ser: P('fui fuiste fue fuimos fuisteis fueron'),
    ir: P('fui fuiste fue fuimos fuisteis fueron'),
    dar: P('di diste dio dimos disteis dieron'),
    ver: P('vi viste vio vimos visteis vieron'),
    hacer: P('hice hiciste hizo hicimos hicisteis hicieron'),
    decir: P('dije dijiste dijo dijimos dijisteis dijeron'),
    traer: P('traje trajiste trajo trajimos trajisteis trajeron'),
    conducir: P('conduje condujiste condujo condujimos condujisteis condujeron'),
    leer: P('leí leíste leyó leímos leísteis leyeron'),
    oír: P('oí oíste oyó oímos oísteis oyeron'),
  },
  imperfecto: {
    ser: P('era eras era éramos erais eran'),
    ir: P('iba ibas iba íbamos ibais iban'),
    ver: P('veía veías veía veíamos veíais veían'),
  },
};

// «Сильный» претерит: основа + e, iste, o, imos, isteis, ieron.
const STRONG_PRET = { estar: 'estuv', tener: 'tuv', poder: 'pud', poner: 'pus', querer: 'quis', saber: 'sup', venir: 'vin', haber: 'hub' };
// Основа будущего времени.
const FUT_STEM = { tener: 'tendr', venir: 'vendr', poner: 'pondr', salir: 'saldr', poder: 'podr', saber: 'sabr', querer: 'querr', hacer: 'har', decir: 'dir', haber: 'habr' };
// Неправильное «я» в настоящем.
const YO_PRESENT = { hacer: 'hago', poner: 'pongo', salir: 'salgo', traer: 'traigo', conocer: 'conozco', conducir: 'conduzco', caer: 'caigo' };
// Чередование в корне под ударением (настоящее: yo, tú, él, ellos).
const STEM = {
  querer: ['e', 'ie'], pensar: ['e', 'ie'], empezar: ['e', 'ie'], entender: ['e', 'ie'], sentir: ['e', 'ie'], preferir: ['e', 'ie'], cerrar: ['e', 'ie'],
  poder: ['o', 'ue'], volver: ['o', 'ue'], dormir: ['o', 'ue'], encontrar: ['o', 'ue'], recordar: ['o', 'ue'], costar: ['o', 'ue'],
  jugar: ['u', 'ue'],
  pedir: ['e', 'i'], seguir: ['e', 'i'], servir: ['e', 'i'], repetir: ['e', 'i'],
};
// -ir с чередованием: в indefinido 3-е лицо e→i, o→u (pidió, durmió).
const IR_PRET = { pedir: ['e', 'i'], seguir: ['e', 'i'], servir: ['e', 'i'], repetir: ['e', 'i'], sentir: ['e', 'i'], preferir: ['e', 'i'], dormir: ['o', 'u'] };
const PARTICIPLE = {
  hacer: 'hecho', decir: 'dicho', ver: 'visto', poner: 'puesto', volver: 'vuelto', escribir: 'escrito', abrir: 'abierto',
  romper: 'roto', morir: 'muerto', leer: 'leído', oír: 'oído', traer: 'traído', creer: 'creído', caer: 'caído',
};

const ENDINGS = {
  presente: { ar: P('o as a amos áis an'), er: P('o es e emos éis en'), ir: P('o es e imos ís en') },
  indefinido: { ar: P('é aste ó amos asteis aron'), er: P('í iste ió imos isteis ieron'), ir: P('í iste ió imos isteis ieron') },
  imperfecto: { ar: P('aba abas aba ábamos abais aban'), er: P('ía ías ía íamos íais ían'), ir: P('ía ías ía íamos íais ían') },
};
const FUT_END = P('é ás á emos éis án');

const group = (inf) => (inf.endsWith('ír') ? 'ir' : inf.slice(-2));
const stemOf = (inf) => inf.slice(0, -2);

// Замена последнего вхождения гласной корня (ent-e-nd → ent-ie-nd).
function changeStem(stem, [from, to]) {
  const i = stem.lastIndexOf(from);
  return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + from.length);
}

export function participle(inf) {
  if (PARTICIPLE[inf]) return PARTICIPLE[inf];
  return stemOf(inf) + (group(inf) === 'ar' ? 'ado' : 'ido');
}

// Форма глагола: tense — id времени, p — лицо 0…5.
export function conjugate(inf, tense, p) {
  const g = group(inf);
  let stem = stemOf(inf);
  if (TABLES[tense] && TABLES[tense][inf]) return TABLES[tense][inf][p];
  switch (tense) {
    case 'presente': {
      if (p === 0 && YO_PRESENT[inf]) return YO_PRESENT[inf];
      if (STEM[inf] && (p <= 2 || p === 5)) stem = changeStem(stem, STEM[inf]);
      return stem + ENDINGS.presente[g][p];
    }
    case 'indefinido': {
      if (STRONG_PRET[inf]) return STRONG_PRET[inf] + P('e iste o imos isteis ieron')[p];
      if (p === 0 && g === 'ar') {
        if (stem.endsWith('c')) return `${stem.slice(0, -1)}qué`;
        if (stem.endsWith('g')) return `${stem}ué`;
        if (stem.endsWith('z')) return `${stem.slice(0, -1)}cé`;
      }
      if (IR_PRET[inf] && (p === 2 || p === 5)) stem = changeStem(stem, IR_PRET[inf]);
      return stem + ENDINGS.indefinido[g][p];
    }
    case 'imperfecto':
      return stem + ENDINGS.imperfecto[g][p];
    case 'perfecto':
      return `${TABLES.presente.haber[p]} ${participle(inf)}`;
    case 'futuro':
      return (FUT_STEM[inf] || inf.replace('í', 'i')) + FUT_END[p];
    default:
      return '';
  }
}

export function conjugationTable(inf, tense) {
  return PERSONS.map((person, p) => ({ person, form: conjugate(inf, tense, p) }));
}

export const tenseById = (id) => TENSES.find((t) => t.id === id);
export const verbByInf = (inf) => VERBS.find((v) => v.inf === inf);

// Карточка тренажёра глаголов: один глагол в одном времени, лицо выбирается при каждом показе.
export function verbCardKey(inf, tense) { return `${inf} · ${tense}`; }

export function makeVerbCard(inf, tense) {
  const v = verbByInf(inf);
  return { kind: 'verb', es: verbCardKey(inf, tense), verb: inf, tense, ru: v ? v.ru : '', source: 'verbs' };
}

// Сравнение ответа: точно — 'ok'; верно, но без ударения — 'close'; иначе — 'wrong'.
export function checkForm(expected, got) {
  const clean = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const bare = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!clean(got)) return 'wrong';
  if (clean(got) === clean(expected)) return 'ok';
  if (bare(got) === bare(expected)) return 'close';
  return 'wrong';
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conjugate, participle, checkForm, VERBS, TENSES, makeVerbCard } from '../js/verbs.js';
import { checkNounAnswer, pickCardType, availableTypes, bareNoun, withArticle } from '../js/exercises.js';
import { makeFixCard, mistakesFromLesson } from '../js/mistakes.js';
import { mergeWords } from '../js/merge.js';
import { FALSE_FRIENDS, GENDER_SET, SER_ESTAR, POR_PARA } from '../js/sets.js';
import { nextVerbs, setToWords, fill, pick } from '../js/drills.js';

const forms = (inf, tense) => [0, 1, 2, 3, 4, 5].map((p) => conjugate(inf, tense, p)).join(' ');

test('спряжение: правильные глаголы во всех временах', () => {
  assert.equal(forms('hablar', 'presente'), 'hablo hablas habla hablamos habláis hablan');
  assert.equal(forms('comer', 'indefinido'), 'comí comiste comió comimos comisteis comieron');
  assert.equal(forms('vivir', 'imperfecto'), 'vivía vivías vivía vivíamos vivíais vivían');
  assert.equal(forms('trabajar', 'perfecto'), 'he trabajado has trabajado ha trabajado hemos trabajado habéis trabajado han trabajado');
  assert.equal(forms('hablar', 'futuro'), 'hablaré hablarás hablará hablaremos hablaréis hablarán');
});

test('спряжение: неправильные и с чередованием', () => {
  assert.equal(forms('ser', 'presente'), 'soy eres es somos sois son');
  assert.equal(forms('tener', 'presente'), 'tengo tienes tiene tenemos tenéis tienen');
  assert.equal(forms('poder', 'presente'), 'puedo puedes puede podemos podéis pueden');
  assert.equal(forms('jugar', 'presente'), 'juego juegas juega jugamos jugáis juegan');
  assert.equal(forms('pedir', 'presente'), 'pido pides pide pedimos pedís piden');
  assert.equal(forms('hacer', 'indefinido'), 'hice hiciste hizo hicimos hicisteis hicieron');
  assert.equal(forms('estar', 'indefinido'), 'estuve estuviste estuvo estuvimos estuvisteis estuvieron');
  assert.equal(forms('dormir', 'indefinido'), 'dormí dormiste durmió dormimos dormisteis durmieron');
  assert.equal(forms('ir', 'imperfecto'), 'iba ibas iba íbamos ibais iban');
  assert.equal(forms('decir', 'futuro'), 'diré dirás dirá diremos diréis dirán');
  assert.equal(conjugate('pagar', 'indefinido', 0), 'pagué');
  assert.equal(conjugate('buscar', 'indefinido', 0), 'busqué');
  assert.equal(conjugate('empezar', 'indefinido', 0), 'empecé');
  assert.equal(conjugate('leer', 'indefinido', 5), 'leyeron');
  assert.equal(conjugate('conocer', 'presente', 0), 'conozco');
  assert.equal(conjugate('oír', 'futuro', 0), 'oiré');
  assert.equal(participle('volver'), 'vuelto');
  assert.equal(participle('escribir'), 'escrito');
});

test('спряжение: каждая форма каждого глагола непустая', () => {
  for (const v of VERBS) for (const t of TENSES) for (let p = 0; p < 6; p++) {
    assert.ok(conjugate(v.inf, t.id, p), `${v.inf} ${t.id} ${p}`);
  }
});

test('checkForm: ударение — «почти»', () => {
  assert.equal(checkForm('habláis', 'habláis'), 'ok');
  assert.equal(checkForm('habláis', 'hablais'), 'close');
  assert.equal(checkForm('habláis', 'hablan'), 'wrong');
});

test('артикль: без него — «почти», чужой — «почти» с подсказкой', () => {
  const w = { es: 'perro', ru: 'собака', gender: 'el' };
  assert.equal(checkNounAnswer(w, 'el perro').result, 'ok');
  assert.equal(checkNounAnswer(w, 'un perro').result, 'ok');
  assert.deepEqual(checkNounAnswer(w, 'perro'), { result: 'close', note: 'Не забудьте артикль: el perro' });
  assert.equal(checkNounAnswer({ es: 'la mano', gender: 'la' }, 'el mano').note, 'Род: la mano');
  assert.equal(checkNounAnswer({ es: 'casa' }, 'casa').result, 'ok');
  assert.equal(bareNoun('la mano'), 'mano');
  assert.equal(withArticle({ es: 'agua', gender: 'el' }), 'el agua');
});

test('типы карточек: глагол, ошибка, род', () => {
  assert.equal(pickCardType({ kind: 'verb', reps: 3 }), 'verb');
  assert.equal(pickCardType({ kind: 'fix' }), 'fix');
  assert.ok(availableTypes({ es: 'perro', gender: 'el' }).includes('gender'));
  assert.ok(!availableTypes({ es: 'rápido', gender: '' }).includes('gender'));
});

test('ошибка → карточка «Исправьте фразу»', () => {
  const c = makeFixCard({ phrase: 'Yo soy cansado', corrected: 'Yo estoy cansado', topic: 'ser и estar', source: 'chat' });
  assert.equal(c.kind, 'fix');
  assert.equal(c.es, 'Yo estoy cansado');
  assert.equal(c.wrong, 'Yo soy cansado');
  assert.equal(makeFixCard({ phrase: 'soy', corrected: 'estoy' }), null); // одно слово без контекста
  assert.equal(makeFixCard({ phrase: 'Hola amigo', corrected: 'Hola amigo' }), null);
  assert.equal(makeFixCard({ phrase: '(без ответа)', corrected: 'Estoy en casa' }), null);
});

test('урок: выбор в предложении с пропуском даёт целую фразу', () => {
  const lesson = { topic: 'ser/estar', exercises: [{ type: 'choice', prompt: 'Yo ___ cansado', options: ['soy', 'estoy'], answer: 1 }] };
  const [m] = mistakesFromLesson(lesson, ['soy'], [{ correct: false }]);
  assert.equal(m.phrase, 'Yo soy cansado');
  assert.equal(m.corrected, 'Yo estoy cansado');
});

test('слияние: карточка глагола не путается со словом', () => {
  const out = mergeWords([{ es: 'ser · presente', kind: 'verb' }], [{ es: 'ser · presente' }]);
  assert.equal(out.length, 2);
  const dead = mergeWords([{ es: 'tener · presente', kind: 'verb', createdAt: 1 }], [], [{ key: 'verb:tener · presente', at: 5 }]);
  assert.equal(dead.length, 0);
});

test('наборы: упражнения корректны', () => {
  for (const it of [...SER_ESTAR, ...POR_PARA]) {
    assert.ok(it.s.includes('___'), it.s);
    assert.ok(it.o.includes(it.a), it.s);
    assert.ok(it.why, it.s);
  }
  const es = FALSE_FRIENDS.map((f) => f.es);
  assert.equal(new Set(es).size, es.length);
  assert.ok(FALSE_FRIENDS.length >= 45);
  for (const g of GENDER_SET) assert.ok(g.es.startsWith(`${g.gender} `), g.es);
  assert.equal(fill('Mi hermano ___ médico.', 'es'), 'Mi hermano es médico.');
  assert.equal(pick([1, 2, 3, 4], 2).length, 2);
});

test('тренажёры: следующие глаголы и набор без дублей', () => {
  const first = nextVerbs([], 'presente');
  assert.equal(first.length, 10);
  assert.equal(first[0].inf, 'ser');
  const cards = first.map((v) => makeVerbCard(v.inf, 'presente'));
  assert.equal(nextVerbs(cards, 'presente')[0].inf, VERBS[10].inf);
  assert.equal(nextVerbs(cards, 'futuro')[0].inf, 'ser');
  const words = setToWords(FALSE_FRIENDS.slice(0, 3), [{ es: 'familia' }]);
  assert.deepEqual(words.map((w) => w.es), ['el apellido', 'la carta']);
  assert.equal(words[1].gender, 'la');
});

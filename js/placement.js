// Входной тест уровня: 24 вопроса от A1 до B2 (по 6 на уровень), без ИИ. ~5 минут.
import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const TEST = [
  { level: 'A1', s: 'Yo ___ de Rusia.', o: ['soy', 'estoy', 'es'], a: 0 },
  { level: 'A1', s: '¿Dónde ___ el baño?', o: ['es', 'está', 'hay'], a: 1 },
  { level: 'A1', s: 'En mi calle ___ dos farmacias.', o: ['están', 'hay', 'son'], a: 1 },
  { level: 'A1', s: 'Me ___ mucho la paella.', o: ['gusto', 'gusta', 'gustan'], a: 1 },
  { level: 'A1', s: 'Mis padres ___ en Benidorm.', o: ['vivo', 'vivimos', 'viven'], a: 2 },
  { level: 'A1', s: '___ agua del mar está fría.', o: ['La', 'El', 'Los'], a: 1 },
  { level: 'A2', s: 'Ayer ___ a la playa con mis amigos.', o: ['voy', 'fui', 'iba'], a: 1 },
  { level: 'A2', s: 'Hoy ___ mucho, estoy muerto.', o: ['he trabajado', 'trabajé', 'trabajaba'], a: 0 },
  { level: 'A2', s: 'Mañana ___ a llamar a mi madre.', o: ['voy', 'iré', 'vamos'], a: 0 },
  { level: 'A2', s: '¿El libro? Ya ___ he leído.', o: ['le', 'lo', 'la'], a: 1 },
  { level: 'A2', s: 'Ahora mismo ___ comiendo, te llamo luego.', o: ['soy', 'estoy', 'tengo'], a: 1 },
  { level: 'A2', s: 'Madrid es más grande ___ Valencia.', o: ['como', 'que', 'de'], a: 1 },
  { level: 'B1', s: 'Cuando era niño, ___ al fútbol todos los días.', o: ['jugué', 'jugaba', 'he jugado'], a: 1 },
  { level: 'B1', s: 'Espero que ___ buen tiempo el sábado.', o: ['hace', 'haga', 'hará'], a: 1 },
  { level: 'B1', s: 'Si tengo tiempo, te ___ esta tarde.', o: ['llamaré', 'llamaría', 'llamara'], a: 0 },
  { level: 'B1', s: 'Gracias ___ todo.', o: ['para', 'por', 'de'], a: 1 },
  { level: 'B1', s: 'Cuando llegué a la estación, el tren ya ___.', o: ['salió', 'había salido', 'ha salido'], a: 1 },
  { level: 'B1', s: 'Ana me dijo que ___ muy cansada.', o: ['está', 'estaba', 'estará'], a: 1 },
  { level: 'B2', s: 'Si ___ más dinero, viajaría por todo el mundo.', o: ['tengo', 'tuviera', 'tendría'], a: 1 },
  { level: 'B2', s: 'Te lo explico para que lo ___.', o: ['entiendes', 'entiendas', 'entenderás'], a: 1 },
  { level: 'B2', s: 'Me pidió que le ___ con la mudanza.', o: ['ayudo', 'ayudara', 'ayudaré'], a: 1 },
  { level: 'B2', s: '___ venden pisos en esta zona.', o: ['Se', 'Le', 'Lo'], a: 0 },
  { level: 'B2', s: 'Llevo tres años ___ español.', o: ['estudiar', 'estudiando', 'estudiado'], a: 1 },
  { level: 'B2', s: 'No creo que ___ razón.', o: ['tienes', 'tengas', 'tendrás'], a: 1 },
];

const ORDER = ['A1', 'A2', 'B1', 'B2'];
export const PASS = 4; // из 6 на уровне

// Итог: уровень = последний пройденный подряд (4+ из 6). Чистая функция.
export function scorePlacement(answers) {
  const by = Object.fromEntries(ORDER.map((l) => [l, 0]));
  TEST.forEach((q, i) => { if (answers[i] === q.a) by[q.level]++; });
  let cefr = 'A0';
  for (const l of ORDER) {
    if (by[l] >= PASS) cefr = l; else break;
  }
  const app = cefr === 'B2' ? 'B2+' : (cefr === 'A2' || cefr === 'B1') ? 'A2-B1' : 'A0-A1';
  return { by, cefr, level: app };
}

const LEVEL_TEXT = {
  A0: 'Вы в самом начале — отлично, будем строить с основ.',
  A1: 'Базовый уровень: простые фразы в настоящем времени.',
  A2: 'Уверенный базовый: прошедшие времена и бытовые ситуации.',
  B1: 'Средний: свободно в быту, пора за субхунтив и нюансы времён.',
  B2: 'Выше среднего: сложные конструкции уже по силам.',
};

async function render(container) {
  const e = escapeHtml;
  const answers = [];
  let i = 0;
  const paint = () => {
    if (i >= TEST.length) return finish();
    const q = TEST[i];
    container.innerHTML = `
      <h1>Тест уровня</h1>
      <div class="drill-progress" aria-label="Вопрос ${i + 1} из ${TEST.length}"><span style="width:${(i / TEST.length) * 100}%"></span></div>
      <p class="status">Вопрос ${i + 1} из ${TEST.length}. Не знаете — смело жмите «Не знаю», так результат будет точнее.</p>
      <div class="study-card drill-card">
        <div class="drill-sentence" lang="es">${e(q.s).replace('___', '<span class="gap">＿＿＿</span>')}</div>
        <div class="ob-options">${q.o.map((o, k) => `<button type="button" class="ob-option" data-k="${k}" lang="es"><b>${e(o)}</b></button>`).join('')}</div>
        <button type="button" class="ghost wide" data-k="-1">Не знаю</button>
      </div>`;
    container.querySelectorAll('[data-k]').forEach((b) => {
      b.onclick = () => { answers[i] = Number(b.dataset.k); i++; paint(); };
    });
  };
  const finish = () => {
    const r = scorePlacement(answers);
    container.innerHTML = `
      <h1>Ваш уровень</h1>
      <section class="summary-card">
        <div class="summary-hello es">${e(r.cefr === 'A0' ? 'Principiante' : r.cefr)}</div>
        <p>${e(LEVEL_TEXT[r.cefr])}</p>
        <div class="summary-stats">${ORDER.map((l) => `<div><b>${r.by[l]}/6</b><span>${l}</span></div>`).join('')}</div>
      </section>
      <p class="status">Уровень в приложении: ${e(r.level.replace('-', '–'))}. Под него подстроятся уроки, сценки, истории и «5 слов». Курс Учителя можно пересобрать на вкладке «Наставник → Уроки».</p>
      <button id="pl-save" class="big">${icon('check', 'ic ic-sm')} Сохранить уровень</button>
      <button id="pl-again" class="ghost wide">Пройти ещё раз</button>`;
    container.querySelector('#pl-again').onclick = () => render(container);
    container.querySelector('#pl-save').onclick = async () => {
      await setSetting('level', r.level);
      await setSetting('placement', { cefr: r.cefr, by: r.by, date: Date.now() });
      location.hash = (await getSetting('onboarded')) ? '#progress' : '#today';
    };
  };
  paint();
}

registerFeature({ id: 'placement', title: 'Тест уровня', icon: '🧭', order: 92, render });

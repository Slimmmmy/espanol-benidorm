// «Тренажёры» (вкладка «Повторить»): грамматика как навык — глаголы, ser/estar, por/para, род, ложные друзья.
// Всё работает без ИИ: формы глаголов строит код, упражнения — из проверенных наборов.
import { registerFeature } from './app.js';
import { getAllWords, getVocab, putWord } from './db.js';
import { newCard } from './srs.js';
import { VERBS, TENSES, conjugate, checkForm, PERSONS, makeVerbCard, verbCardKey } from './verbs.js';
import { FALSE_FRIENDS, GENDER_SET, SER_ESTAR, POR_PARA } from './sets.js';
import { findExistingWord } from './wordpick.js';
import { logMistakes } from './mistakes.js';
import { recordActivity } from './activity.js';
import { recordStudyDay } from './stats.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const VERB_BATCH = 10;
export const ROUND = 10;

// Перемешать и взять n (детерминированно, если передан rnd).
export function pick(items, n, rnd = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Следующие глаголы для времени, которых ещё нет в повторении (в порядке частоты).
export function nextVerbs(cards, tense, n = VERB_BATCH) {
  const have = new Set((cards || []).filter((c) => c.kind === 'verb').map((c) => c.es));
  return VERBS.filter((v) => !have.has(verbCardKey(v.inf, tense))).slice(0, n);
}

// Набор слов → карточки словаря (только тех, которых ещё нет).
export function setToWords(set, vocab, source = 'set') {
  return set
    .filter((it) => !findExistingWord(vocab, it.es))
    .map((it) => {
      const m = /^(el|la)\s/i.exec(it.es);
      return {
        es: it.es, ru: it.ru, example: it.example || '', exampleRu: it.exampleRu || '',
        gender: it.gender || (m ? m[1].toLowerCase() : ''), pos: '', local: it.note || '', source,
      };
    });
}

export const fill = (s, word) => s.replace('___', word);

async function addWords(list) {
  const now = Date.now();
  let i = 0;
  for (const w of list) await putWord({ ...w, createdAt: now + i++, ...newCard(now) });
  return list.length;
}

// ── Упражнение с выбором (ser/estar, por/para) ───────────────
function runChoice(container, { title, topic, items }) {
  const e = escapeHtml;
  const round = pick(items, ROUND);
  let idx = 0;
  let score = 0;
  const wrong = [];
  const paint = () => {
    if (idx >= round.length) return finish();
    const it = round[idx];
    container.innerHTML = `
      <h1>${e(title)}</h1>
      <div class="drill-progress" aria-label="Вопрос ${idx + 1} из ${round.length}"><span style="width:${(idx / round.length) * 100}%"></span></div>
      <div class="study-card drill-card">
        <div class="drill-sentence" lang="es">${e(it.s).replace('___', '<span class="gap">＿＿＿</span>')}</div>
        <div class="gender-row">${it.o.map((o) => `<button type="button" class="ghost" data-opt="${e(o)}" lang="es">${e(o)}</button>`).join('')}</div>
        <div id="drill-fb"></div>
      </div>`;
    container.querySelectorAll('[data-opt]').forEach((b) => {
      b.onclick = () => {
        const ok = b.dataset.opt === it.a;
        if (ok) score++; else wrong.push({ phrase: fill(it.s, b.dataset.opt), corrected: fill(it.s, it.a), topic });
        container.querySelectorAll('[data-opt]').forEach((x) => {
          x.disabled = true;
          if (x.dataset.opt === it.a) x.classList.add('right');
          else if (x === b) x.classList.add('wrong');
        });
        container.querySelector('#drill-fb').innerHTML = `
          <div class="${ok ? 'gr-ok' : 'gr-bad'}" role="status">${ok ? `${icon('check', 'ic ic-sm')}Верно!` : 'Не совсем'}</div>
          <div class="word-ex" lang="es"><b>${e(fill(it.s, it.a))}</b></div>
          <div class="word-local">${e(it.why)}</div>
          <button id="drill-next" class="big">${idx + 1 < round.length ? 'Дальше' : 'Итог'}</button>`;
        speak(fill(it.s, it.a));
        const next = container.querySelector('#drill-next');
        next.focus();
        next.onclick = () => { idx++; paint(); };
      };
    });
  };
  const finish = async () => {
    await recordActivity('grammar');
    await recordStudyDay();
    if (wrong.length) await logMistakes(wrong, 'drill');
    container.innerHTML = `
      <h1>${e(title)}</h1>
      <section class="summary-card">
        <div class="summary-hello es">${score === round.length ? '¡Perfecto!' : score >= round.length * 0.7 ? '¡Muy bien!' : '¡Ánimo!'}</div>
        <p><b>${score} из ${round.length}</b> верно.</p>
        ${wrong.length ? `<p class="status">Ошибки добавлены в повторение карточками «Исправьте фразу» — вернутся через пару дней.</p>
          <ul class="drill-wrong" lang="es">${wrong.map((w) => `<li><s>${e(w.phrase)}</s><br><b>${e(w.corrected)}</b></li>`).join('')}</ul>` : ''}
      </section>
      <button id="drill-again" class="big">Ещё раунд</button>
      <button id="drill-back" class="ghost wide">К тренажёрам</button>`;
    container.querySelector('#drill-again').onclick = () => runChoice(container, { title, topic, items });
    container.querySelector('#drill-back').onclick = () => render(container);
  };
  paint();
}

// ── Разминка глаголов: формы вводом, без влияния на расписание повторений ──
function runVerbs(container, tense) {
  const e = escapeHtml;
  const t = TENSES.find((x) => x.id === tense);
  const round = pick(VERBS.slice(0, 25), ROUND).map((v) => ({ v, p: Math.floor(Math.random() * PERSONS.length) }));
  let idx = 0;
  let score = 0;
  const wrong = [];
  const paint = () => {
    if (idx >= round.length) return finish();
    const { v, p } = round[idx];
    const expected = conjugate(v.inf, tense, p);
    container.innerHTML = `
      <h1>Глаголы: ${e(t.title)}</h1>
      <div class="drill-progress"><span style="width:${(idx / round.length) * 100}%"></span></div>
      <div class="study-card drill-card">
        <div class="study-front es" lang="es"><b>${e(v.inf)}</b></div>
        <div class="muted study-hint">${e(v.ru)}</div>
        <div class="verb-ask"><span class="chip chip-person" lang="es">${e(PERSONS[p])}</span></div>
        <input id="drill-input" type="text" placeholder="Форма глагола…" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" lang="es">
        <button id="drill-check" class="big">Проверить</button>
        <div id="drill-fb"></div>
      </div>`;
    const input = container.querySelector('#drill-input');
    input.focus();
    const check = () => {
      if (input.disabled) return;
      const said = input.value.trim();
      if (!said) return;
      input.disabled = true;
      container.querySelector('#drill-check').classList.add('hidden');
      const r = checkForm(expected, said);
      if (r === 'ok') score++;
      else wrong.push(`${v.inf} · ${PERSONS[p]} → ${expected}`);
      container.querySelector('#drill-fb').innerHTML = `
        <div class="${r === 'ok' ? 'gr-ok' : 'gr-bad'}" role="status">${r === 'ok' ? `${icon('check', 'ic ic-sm')}Верно!` : r === 'close' ? 'Почти — проверьте ударение' : 'Не совсем'}</div>
        <div class="study-es" lang="es"><b>${e(expected)}</b></div>
        <button id="drill-next" class="big">${idx + 1 < round.length ? 'Дальше' : 'Итог'}</button>`;
      speak(expected);
      const next = container.querySelector('#drill-next');
      next.focus();
      next.onclick = () => { idx++; paint(); };
    };
    container.querySelector('#drill-check').onclick = check;
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); check(); } });
  };
  const finish = async () => {
    await recordActivity('grammar');
    await recordStudyDay();
    container.innerHTML = `
      <h1>Глаголы: ${e(t.title)}</h1>
      <section class="summary-card">
        <div class="summary-hello es">${score === round.length ? '¡Perfecto!' : '¡Buen trabajo!'}</div>
        <p><b>${score} из ${round.length}</b> верно.</p>
        ${wrong.length ? `<ul class="drill-wrong" lang="es">${wrong.map((w) => `<li>${e(w)}</li>`).join('')}</ul>` : ''}
      </section>
      <button id="drill-again" class="big">Ещё раунд</button>
      <button id="drill-back" class="ghost wide">К тренажёрам</button>`;
    container.querySelector('#drill-again').onclick = () => runVerbs(container, tense);
    container.querySelector('#drill-back').onclick = () => render(container);
  };
  paint();
}

async function render(container) {
  const e = escapeHtml;
  const [all, vocab] = await Promise.all([getAllWords(), getVocab()]);
  if (container.dataset.screen !== 'drills') return;
  const fixCount = all.filter((w) => w.kind === 'fix').length;
  const genderLeft = setToWords(GENDER_SET, vocab).length;
  const ffLeft = setToWords(FALSE_FRIENDS, vocab).length;
  const tenseRows = TENSES.map((t) => {
    const added = all.filter((w) => w.kind === 'verb' && w.tense === t.id).length;
    const next = nextVerbs(all, t.id).length;
    return `<div class="drill-row">
      <div class="drill-row-text"><b lang="es">${e(t.title)}</b> <span class="muted">— ${e(t.ru)}</span>
        <div class="muted drill-hint">${e(t.hint)}</div>
        <div class="muted drill-hint">В повторении: ${added} из ${VERBS.length}</div></div>
      <div class="drill-row-actions">
        <button type="button" class="ghost" data-warm="${t.id}">Разминка</button>
        ${next ? `<button type="button" data-addverbs="${t.id}">＋ ${next}</button>` : ''}
      </div>
    </div>`;
  }).join('');
  container.innerHTML = `
    <h1>Тренажёры</h1>
    <p class="lead">Грамматика как навык: короткие раунды и карточки в общем повторении.</p>
    <p id="drills-status" class="status" role="status"></p>

    <h2>ser или estar · por или para</h2>
    <div class="hub-grid">
      <button type="button" class="hub-tile" id="dr-serestar"><span class="hub-icon">${icon('grammar')}</span><span class="hub-title">ser / estar</span><span class="hub-sub">${SER_ESTAR.length} пар «Es aburrido / Está aburrido» с объяснением</span></button>
      <button type="button" class="hub-tile" id="dr-porpara"><span class="hub-icon">${icon('arrow')}</span><span class="hub-title">por / para</span><span class="hub-sub">${POR_PARA.length} фраз: причина или цель, «через» или «куда»</span></button>
    </div>

    <h2>Глаголы</h2>
    <p class="status">Формы строит приложение по правилам испанского (с vosotros). «＋» добавляет 10 частых глаголов в повторение: каждый раз спросит новое лицо.</p>
    <div class="drill-list">${tenseRows}</div>

    <h2>Род существительных</h2>
    <div class="word-card">
      <p>${GENDER_SET.length} слов, где род не угадать или он не такой, как в русском: <span lang="es">la mano, el problema, el agua, la leche</span>…</p>
      <p class="status">Существительные в повторении теперь спрашивают артикль: «el или la?», а в письменном ответе без артикля засчитывается «почти».</p>
      ${genderLeft ? `<button type="button" id="dr-gender">＋ Добавить ${genderLeft} в повторение</button>` : '<p class="daily-added">✓ Набор уже в повторении</p>'}
    </div>

    <h2>Ложные друзья</h2>
    <div class="word-card">
      <p>${FALSE_FRIENDS.length} слов, похожих на русские, но с другим значением.</p>
      <details class="tch-extra"><summary>Посмотреть список</summary>
        <ul class="ff-list">${FALSE_FRIENDS.map((f) => `<li><b lang="es">${e(f.es)}</b> — ${e(f.ru)}<br><span class="muted">${e(f.note)}</span></li>`).join('')}</ul>
      </details>
      ${ffLeft ? `<button type="button" id="dr-ff">＋ Добавить ${ffLeft} в повторение</button>` : '<p class="daily-added">✓ Набор уже в повторении</p>'}
    </div>

    <h2>Ваши ошибки</h2>
    <div class="word-card">
      <p>Ошибки из чата, уроков, сценок и проверки фраз сами становятся карточками «Исправьте фразу» и возвращаются через несколько дней.</p>
      <p class="status">Сейчас в повторении: ${fixCount}.</p>
    </div>`;

  container.querySelector('#dr-serestar').onclick = () => runChoice(container, { title: 'ser или estar?', topic: 'ser и estar', items: SER_ESTAR });
  container.querySelector('#dr-porpara').onclick = () => runChoice(container, { title: 'por или para?', topic: 'por и para', items: POR_PARA });
  container.querySelectorAll('[data-warm]').forEach((b) => { b.onclick = () => runVerbs(container, b.dataset.warm); });
  container.querySelectorAll('[data-addverbs]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      const tense = b.dataset.addverbs;
      const list = nextVerbs(await getAllWords(), tense).map((v) => makeVerbCard(v.inf, tense));
      await addWords(list);
      await render(container);
      const s = container.querySelector('#drills-status');
      if (s) s.textContent = `Добавлено глаголов: ${list.length}. Они появятся в «Повторении» вместе с новыми словами.`;
    };
  });
  const addSet = (id, set) => {
    const btn = container.querySelector(id);
    if (!btn) return;
    btn.onclick = async () => {
      btn.disabled = true;
      const n = await addWords(setToWords(set, await getVocab()));
      await render(container);
      const s = container.querySelector('#drills-status');
      if (s) s.textContent = `Добавлено слов: ${n}. Новые карточки приходят порциями — по дневному лимиту новых.`;
    };
  };
  addSet('#dr-gender', GENDER_SET);
  addSet('#dr-ff', FALSE_FRIENDS);
}

registerFeature({ id: 'drills', title: 'Тренажёры', icon: '✍️', order: 11, render });

// «Учебник» (вкладка «Наставник» → «Уроки»): программа A1 → B2 урок за уроком.
// Урок = теория (правило, почему и когда, ловушки, тонкости, диалог, слова) → вопросы учителю →
// упражнения по нарастающей → итог. 70% — урок пройден. После каждого блока — повторение.
import { registerFeature } from './app.js';
import { buildProfile, saveProfileNote, recordLesson } from './profile.js';
import { generateLesson, reviewLesson, generateTheory, generateTextbookExercises, askAboutLesson } from './claude.js';
import { UNITS, STEPS, stepById, nextStep, recordResult, unitStats, isPassed, lessonBrief, startFor, LESSON_COUNT, PASS } from './textbook.js';
import { escapeHtml, stagedStatus } from './util.js';
import { enableWordPick, findExistingWord } from './wordpick.js';
import { logMistakes, mistakesFromLesson } from './mistakes.js';
import { recordActivity } from './activity.js';
import { recordStudyDay } from './stats.js';
import { getSetting, setSetting, getVocab, putWord } from './db.js';
import { newCard } from './srs.js';
import { speak } from './tts.js';
import { icon } from './icons.js';

let busy = false;
let lesson = null;   // текущие упражнения
let current = null;  // текущий шаг учебника (null — свободный урок)
let asked = [];      // вопросы к учителю в этом уроке

const e = escapeHtml;
export const lessonNum = (step) => (step && step.kind === 'lesson' ? Number(step.id.slice(1)) : 0);
const stepLabel = (step) => (step.kind === 'lesson' ? `Урок ${lessonNum(step)}` : step.es);
const theoryKey = (id) => `tbTheory-${id}`;

export async function getTextbook() {
  return (await getSetting('textbook')) || { start: '', done: {} };
}

// Для «Сегодня» и «Занятия»: следующий урок одной строкой.
export async function nextLessonTitle() {
  const [tb, level] = await Promise.all([getTextbook(), getSetting('level')]);
  const s = nextStep(tb, level || 'A2-B1');
  return s ? `${stepLabel(s)}: ${s.title}` : '';
}

const say = (text) => `<button type="button" class="tb-say" data-say="${e(text)}" aria-label="Послушать">${icon('sound', 'ic ic-sm')}</button>`;
const para = (t) => e(t).split(/\n+/).map((x) => `<p>${x}</p>`).join('');
function wireSay(root) {
  root.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say).catch(() => {}); });
}

// ── Оглавление ───────────────────────────────────────────
async function renderToc(container) {
  current = null;
  const [tb, level] = await Promise.all([getTextbook(), getSetting('level')]);
  const lvl = level || 'A2-B1';
  const next = nextStep(tb, lvl);
  const passedLessons = STEPS.filter((s) => s.kind === 'lesson' && isPassed(tb.done[s.id])).length;
  const start = tb.start || startFor(lvl);
  const units = UNITS.map((u) => {
    const st = unitStats(tb, u);
    const open = next && next.unit === u.n;
    const rows = STEPS.filter((s) => s.unit === u.n).map((s) => {
      const rec = tb.done[s.id];
      const isNext = next && s.id === next.id;
      const mark = isPassed(rec) ? icon('check', 'ic ic-sm') : (isNext ? icon('play', 'ic ic-sm') : (rec ? '!' : '·'));
      return `<button class="unit-row tb-row${isNext ? ' unit-next' : ''}${isPassed(rec) ? ' tb-passed' : ''}${s.kind === 'repaso' ? ' tb-repaso' : ''}" data-step="${s.id}">
        <span class="unit-mark">${mark}</span>
        <span class="unit-title">${s.kind === 'lesson' ? `${lessonNum(s)}. ` : ''}${e(s.title)}</span>
        ${rec ? `<span class="unit-score">${e(rec.score)}</span>` : ''}
      </button>`;
    }).join('');
    return `<details class="tb-unit"${open ? ' open' : ''}>
      <summary><span class="tb-unit-n">Unidad ${u.n} · ${u.level}</span><b>${e(u.ru)}</b> <span class="tb-unit-es">${e(u.title)}</span><span class="unit-score">${st.passed}/${st.total}</span></summary>
      <div class="course-list">${rows}</div>
    </details>`;
  }).join('');

  container.innerHTML = `
    <h1>Учебник</h1>
    <div class="study-card">
      <div class="word-ex">Программа A1 → B2 по мотивам Plan Curricular Института Сервантеса: в каждом уроке сначала теория — что, почему и когда, — потом упражнения.</div>
      <div class="tb-bar"><span style="width:${Math.round((passedLessons / LESSON_COUNT) * 100)}%"></span></div>
      <div class="daily-progress">Пройдено уроков: ${passedLessons} из ${LESSON_COUNT}</div>
    </div>
    ${next ? `<button id="tb-next" class="big">${icon('play', 'ic ic-sm')} ${e(stepLabel(next))}: ${e(next.title)}</button>`
      : '<p class="status">🎉 Учебник пройден! Повторяйте любые уроки — упражнения каждый раз новые.</p>'}
    ${start !== 'l1' && !tb.done.l1 ? `<p class="status">Начали с урока ${lessonNum(stepById(start))} по уровню. Предыдущие уроки открыты — пройдите их для повторения. <a href="#" id="tb-from1">Начать с урока 1</a></p>` : ''}
    ${units}
    <details class="tch-extra"><summary>Свободный урок по любой теме</summary>
      <label>Тема<input id="tch-topic" type="text" placeholder="напр. subjuntivo после esperar"></label>
      <button id="tch-free">Свободный урок</button>
    </details>
    <p id="tch-status" class="status" role="status"></p>`;

  if (next) container.querySelector('#tb-next').onclick = () => openStep(container, next);
  container.querySelectorAll('[data-step]').forEach((b) => { b.onclick = () => openStep(container, stepById(b.dataset.step)); });
  const from1 = container.querySelector('#tb-from1');
  if (from1) from1.onclick = async (ev) => { ev.preventDefault(); await setSetting('textbook', { ...tb, start: 'l1', updatedAt: Date.now() }); renderToc(container); };
  container.querySelector('#tch-free').onclick = () => {
    const t = container.querySelector('#tch-topic').value.trim();
    if (t) freeLesson(container, t);
    else container.querySelector('#tch-status').textContent = 'Введите тему урока';
  };
}

// ── Теория ───────────────────────────────────────────────
function theoryHtml(t) {
  const sections = (t.sections || []).map((s) => `
    <section class="tb-section">
      <h2>${e(s.heading)}</h2>
      <div class="tb-text">${para(s.text)}</div>
      ${(s.examples || []).map((x) => `<div class="tb-example">${say(x.es)}<div><div class="tb-es">${e(x.es)}</div><div class="muted">${e(x.ru)}</div>${x.note ? `<div class="tb-note">${e(x.note)}</div>` : ''}</div></div>`).join('')}
    </section>`).join('');
  const traps = (t.traps || []).length ? `<section class="tb-section tb-traps"><h2>Ловушки для русскоговорящих</h2>${t.traps.map((x) => `
      <div class="tb-trap"><div><s>${e(x.wrong)}</s> → <b class="tb-es">${e(x.right)}</b></div><div class="muted">${e(x.why)}</div></div>`).join('')}</section>` : '';
  const nuances = (t.nuances || []).length ? `<section class="tb-section"><h2>Тонкости</h2><ul class="tb-list">${t.nuances.map((x) => `<li>${e(x)}</li>`).join('')}</ul></section>` : '';
  const d = t.dialogue || {};
  const dialogue = (d.lines || []).length ? `<section class="tb-section"><h2>Как это звучит</h2>${d.setting ? `<p class="muted">${e(d.setting)}</p>` : ''}
      <button type="button" class="ghost" id="tb-play-dialogue">${icon('play', 'ic ic-sm')} Прослушать диалог</button>
      ${d.lines.map((l) => `<div class="tb-line"><b>${e(l.speaker)}:</b> <span class="tb-es">${e(l.es)}</span><div class="muted">${e(l.ru)}</div></div>`).join('')}</section>` : '';
  const words = (t.words || []).length ? `<section class="tb-section"><h2>Слова урока</h2>${t.words.map((w) => `
      <div class="tb-example">${say(w.es)}<div><b class="tb-es">${e(w.es)}</b> — ${e(w.ru)}${w.example ? `<div class="muted">${e(w.example)}${w.exampleRu ? ` — ${e(w.exampleRu)}` : ''}</div>` : ''}</div></div>`).join('')}
      <button type="button" id="tb-add-words" class="ghost wide">${icon('plus', 'ic ic-sm')} Добавить слова в повторение</button></section>` : '';
  const summary = (t.summary || []).length ? `<section class="tb-section tb-summary"><h2>Шпаргалка</h2><ul class="tb-list">${t.summary.map((x) => `<li>${e(x)}</li>`).join('')}</ul></section>` : '';
  return `${t.intro ? `<div class="tb-intro">${para(t.intro)}</div>` : ''}${sections}${traps}${nuances}${dialogue}${words}${summary}`;
}

function askHtml() {
  return `<section class="tb-section tb-ask">
    <h2>Спросить учителя</h2>
    <div class="tb-chips">
      <button type="button" class="chip" data-q="Объясни это проще, другими словами.">Объясни проще</button>
      <button type="button" class="chip" data-q="Дай ещё примеров из жизни в Испании.">Ещё примеры</button>
      <button type="button" class="chip" data-q="Почему в испанском так? Какая логика?">Почему так?</button>
      <button type="button" class="chip" data-q="Чем это отличается от русского и где я буду ошибаться?">Сравни с русским</button>
    </div>
    <textarea id="tb-q" rows="2" placeholder="Ваш вопрос по уроку…"></textarea>
    <button type="button" id="tb-ask">Спросить</button>
    <div id="tb-answers"></div>
  </section>`;
}

function answersHtml() {
  return asked.map((x) => `<div class="study-card tb-answer"><div class="muted">❓ ${e(x.q)}</div><div class="tb-text">${para(x.a)}</div>
    ${(x.examples || []).map((ex) => `<div class="tb-example">${say(ex.es)}<div><div class="tb-es">${e(ex.es)}</div><div class="muted">${e(ex.ru)}</div>${ex.note ? `<div class="tb-note">${e(ex.note)}</div>` : ''}</div></div>`).join('')}</div>`).join('');
}

async function addLessonWords(words, btn) {
  const vocab = await getVocab();
  const now = Date.now();
  let n = 0;
  for (const w of words) {
    if (findExistingWord(vocab, w.es)) continue;
    const m = /^(el|la)\s/i.exec(w.es);
    await putWord({ es: w.es, ru: w.ru, example: w.example || '', exampleRu: w.exampleRu || '', gender: m ? m[1].toLowerCase() : '', pos: '', local: '', source: 'textbook', createdAt: now + n, ...newCard(now) });
    n++;
  }
  btn.disabled = true;
  btn.textContent = n ? `Добавлено слов: ${n}` : 'Все слова уже в словаре';
}

async function openStep(container, step, { refresh = false } = {}) {
  if (busy || !step) return;
  current = step;
  asked = [];
  window.scrollTo(0, 0);
  const head = `<p class="tb-kicker">${e(stepLabel(step))} · ${e(step.level)} · Unidad ${step.unit}</p>
    <h1>${e(step.title)}</h1>
    <p class="tb-es tb-sub">${e(step.es)}</p>
    <div class="study-card"><div class="word-ex">🎯 ${e(step.goal)}</div></div>`;

  if (step.kind === 'repaso') {
    const tb = await getTextbook();
    container.innerHTML = `${head}
      <section class="tb-section"><h2>Что повторяем</h2>
      ${UNITS.find((u) => u.n === step.unit).lessons.map((l) => `<button class="unit-row tb-row" data-step="${l.id}"><span class="unit-mark">${isPassed(tb.done[l.id]) ? icon('check', 'ic ic-sm') : '·'}</span><span class="unit-title">${lessonNum(l)}. ${e(l.title)}</span></button>`).join('')}
      <ul class="tb-list">${step.points.map((p) => `<li>${e(p)}</li>`).join('')}</ul></section>
      <button id="tb-ex" class="big">${icon('arrow', 'ic ic-sm')} К упражнениям</button>
      <button id="tb-toc" class="ghost wide">К оглавлению</button>
      <p id="tch-status" class="status" role="status"></p>`;
    container.querySelectorAll('[data-step]').forEach((b) => { b.onclick = () => openStep(container, stepById(b.dataset.step)); });
    container.querySelector('#tb-ex').onclick = () => startExercises(container, step, null);
    container.querySelector('#tb-toc').onclick = () => renderToc(container);
    return;
  }

  container.innerHTML = `${head}<div id="tb-theory"><p class="status" id="tch-status" role="status"></p></div>`;
  let theory = refresh ? null : await getSetting(theoryKey(step.id));
  if (!theory) {
    busy = true;
    const stop = stagedStatus(container.querySelector('#tch-status'), ['Учитель готовит объяснение…', 'Подбираю примеры из жизни в Испании…', 'Собираю типичные ошибки русскоговорящих…', 'Пишу диалог и шпаргалку…'], 7000);
    try {
      theory = await generateTheory(lessonBrief(step), await buildProfile());
      await setSetting(theoryKey(step.id), { ...theory, createdAt: Date.now() });
    } catch (err) {
      stop();
      const s = container.querySelector('#tch-status');
      if (s) s.innerHTML = `${e(err.message)} <button type="button" class="ghost" id="tb-retry">Ещё раз</button> <button type="button" class="ghost" id="tb-toc">К оглавлению</button>`;
      const r = container.querySelector('#tb-retry');
      if (r) r.onclick = () => openStep(container, step);
      const t = container.querySelector('#tb-toc');
      if (t) t.onclick = () => renderToc(container);
      return;
    } finally {
      busy = false;
    }
    stop();
  }
  if (current !== step || !container.querySelector('#tb-theory')) return; // ушли с экрана
  const box = container.querySelector('#tb-theory');
  box.innerHTML = `${theoryHtml(theory)}${askHtml()}
    <button id="tb-ex" class="big">${icon('arrow', 'ic ic-sm')} К упражнениям</button>
    <button id="tb-toc" class="ghost wide">К оглавлению</button>
    <details class="tch-extra"><summary>Объяснение не понравилось?</summary>
      <button type="button" id="tb-refresh" class="ghost">Написать объяснение заново</button></details>
    <p id="tch-status" class="status" role="status"></p>`;
  box.querySelectorAll('.tb-text, .tb-es').forEach((el) => enableWordPick(el));
  wireSay(box);
  const pd = box.querySelector('#tb-play-dialogue');
  if (pd) {
    pd.onclick = async () => {
      for (const l of theory.dialogue.lines) {
        if (current !== step) break;
        try { await speak(l.es); } catch (err) { break; } // eslint-disable-line no-await-in-loop
      }
    };
  }
  const aw = box.querySelector('#tb-add-words');
  if (aw) aw.onclick = () => addLessonWords(theory.words, aw);
  box.querySelectorAll('[data-q]').forEach((c) => { c.onclick = () => ask(container, step, c.dataset.q); });
  box.querySelector('#tb-ask').onclick = () => ask(container, step, box.querySelector('#tb-q').value.trim());
  box.querySelector('#tb-ex').onclick = () => startExercises(container, step, theory);
  box.querySelector('#tb-toc').onclick = () => renderToc(container);
  box.querySelector('#tb-refresh').onclick = () => openStep(container, step, { refresh: true });
}

async function ask(container, step, q) {
  if (!q || busy) return;
  busy = true;
  const status = container.querySelector('#tch-status');
  const btn = container.querySelector('#tb-ask');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Учитель думает…';
  try {
    const r = await askAboutLesson(lessonBrief(step), q, asked);
    asked.push({ q, a: r.answer || '', examples: r.examples || [] });
    const out = container.querySelector('#tb-answers');
    if (!out || current !== step) return;
    out.innerHTML = answersHtml();
    wireSay(out);
    out.querySelectorAll('.tb-text').forEach((el) => enableWordPick(el));
    const ta = container.querySelector('#tb-q');
    if (ta) ta.value = '';
    if (status) status.textContent = '';
    await recordActivity('lesson');
  } catch (err) {
    if (status) status.textContent = err.message;
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
  }
}

// ── Упражнения ───────────────────────────────────────────
function exerciseHtml(ex, i, prevStage) {
  const stage = ex.stage && ex.stage !== prevStage ? `<p class="tb-stage">${e(ex.stage)}</p>` : '';
  if (ex.type === 'choice') {
    const opts = (ex.options || []).map((o, j) => `<label class="opt-row"><input type="radio" name="ex${i}" value="${j}"> ${e(o)}</label>`).join('');
    return `${stage}<div class="lesson-ex" data-ex="${i}"><div class="ex-prompt">${i + 1}. ${e(ex.prompt)}</div>${opts}<div class="tb-result"></div></div>`;
  }
  return `${stage}<div class="lesson-ex" data-ex="${i}"><div class="ex-prompt">${i + 1}. ${e(ex.prompt)}</div><textarea data-open="${i}" rows="2" placeholder="Ваш ответ…" autocapitalize="off"></textarea><div class="tb-result"></div></div>`;
}

function collectAnswers(container) {
  return lesson.exercises.map((ex, i) => {
    if (ex.type === 'choice') {
      const sel = container.querySelector(`input[name="ex${i}"]:checked`);
      return sel ? ((ex.options || [])[Number(sel.value)] || '') : '';
    }
    const ta = container.querySelector(`[data-open="${i}"]`);
    return ta ? ta.value.trim() : '';
  });
}

function renderExercises(container, title) {
  let prev = '';
  const items = (lesson.exercises || []).map((ex, i) => { const h = exerciseHtml(ex, i, prev); prev = ex.stage || prev; return h; }).join('');
  container.innerHTML = `
    <p class="tb-kicker">${current ? `${e(stepLabel(current))} · упражнения` : 'Свободный урок'}</p>
    <h1>${e(title)}</h1>
    ${lesson.explanation ? `<div class="study-card"><div class="word-ex">${e(lesson.explanation)}</div></div>` : ''}
    <div id="tch-ex">${items}</div>
    <button id="tch-check" class="big">Проверить ответы</button>
    ${current && current.kind === 'lesson' ? '<button id="tb-back-theory" class="ghost wide">Вернуться к теории</button>' : ''}
    <p id="tch-status" class="status" role="status"></p>
    <div id="tch-results"></div>`;
  container.querySelectorAll('.ex-prompt, .study-card').forEach((el) => enableWordPick(el));
  container.querySelector('#tch-check').onclick = () => checkLesson(container);
  const bt = container.querySelector('#tb-back-theory');
  if (bt) bt.onclick = () => openStep(container, current);
}

async function startExercises(container, step, theory) {
  if (busy) return;
  busy = true;
  const status = container.querySelector('#tch-status');
  const stop = status ? stagedStatus(status, ['Составляю упражнения…', 'Второй преподаватель проверяет ключи…'], 9000) : () => {};
  try {
    lesson = await generateTextbookExercises(step, lessonBrief(step), theory, await buildProfile());
    stop();
    if (current !== step || !container.querySelector('#tch-status')) return;
    window.scrollTo(0, 0);
    renderExercises(container, step.title);
  } catch (err) {
    stop();
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function freeLesson(container, topic) {
  if (busy) return;
  busy = true;
  current = null;
  const status = container.querySelector('#tch-status');
  const stop = status ? stagedStatus(status, ['Готовлю урок под ваш уровень…', 'Подбираю упражнения…', 'Второй преподаватель проверяет ответы…']) : () => {};
  try {
    lesson = await generateLesson(await buildProfile(), topic);
    stop();
    if (!container.querySelector('#tch-status')) return;
    renderExercises(container, lesson.topic || topic);
  } catch (err) {
    stop();
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function checkLesson(container) {
  if (busy) return;
  busy = true;
  const step = current;
  const status = container.querySelector('#tch-status');
  const btn = container.querySelector('#tch-check');
  const answers = collectAnswers(container);
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Проверяю…';
  try {
    const r = await reviewLesson(lesson, answers);
    if (!container.querySelector('#tch-results')) return;
    if (status) status.textContent = '';
    const total = (lesson.exercises || []).length;
    const res = (r.results || []).slice(0, total);
    lesson.exercises.forEach((ex, i) => {
      const x = res[i] || {};
      const el = container.querySelector(`[data-ex="${i}"] .tb-result`);
      if (!el) return;
      const right = ex.type === 'choice' ? (ex.options || [])[ex.answer] : ex.expected;
      el.innerHTML = `<div class="${x.correct ? 'gr-ok' : 'gr-bad'}">${x.correct ? '✅ Верно' : '❌ Не совсем'}</div>
        ${!x.correct && right ? `<div class="tb-es">Правильно: <b>${e(right)}</b></div>` : ''}
        ${x.comment ? `<div class="word-ex">${e(x.comment)}</div>` : ''}
        ${ex.why ? `<div class="tb-note">Почему: ${e(ex.why)}</div>` : ''}`;
      enableWordPick(el);
    });
    const correct = res.filter((x) => !!x.correct).length;
    const pct = total ? correct / total : 0;
    let verdict = '';
    let nextBtn = '';
    if (step) {
      const tb = recordResult(await getTextbook(), step.id, correct, total);
      await setSetting('textbook', tb);
      const nx = nextStep(tb, (await getSetting('level')) || 'A2-B1');
      if (pct >= PASS) {
        verdict = `<div class="gr-ok">🎉 ${step.kind === 'repaso' ? 'Блок закреплён' : 'Урок пройден'}!</div>`;
        if (nx) nextBtn = `<button id="tb-go-next" class="big">${icon('arrow', 'ic ic-sm')} ${e(stepLabel(nx))}: ${e(nx.title)}</button>`;
      } else {
        verdict = `<div class="gr-bad">Нужно ${Math.round(PASS * 100)}% (${Math.ceil(PASS * total)} из ${total}). Перечитайте разбор и теорию — в следующий раз упражнения будут новые.</div>`;
        nextBtn = `<button id="tb-retry-ex" class="big">Новые упражнения</button>`;
      }
    }
    container.querySelector('#tch-results').innerHTML = `
      <div class="study-card"><b>Итог: ${correct}/${total}</b>${verdict}
        <div class="word-ex">${e(r.summary || '')}</div></div>
      ${nextBtn}
      <button id="tch-back" class="ghost wide">К оглавлению</button>`;
    enableWordPick(container.querySelector('#tch-results'));
    const gn = container.querySelector('#tb-go-next');
    if (gn) gn.onclick = async () => openStep(container, nextStep(await getTextbook(), (await getSetting('level')) || 'A2-B1'));
    const rt = container.querySelector('#tb-retry-ex');
    if (rt) rt.onclick = async () => { const tStep = step; current = tStep; if (tStep.kind === 'repaso') return startExercises(container, tStep, null); return startExercises(container, tStep, await getSetting(theoryKey(tStep.id))); };
    container.querySelector('#tch-back').onclick = () => renderToc(container);
    await logMistakes(mistakesFromLesson(lesson, answers, res));
    await recordActivity('lesson');
    await recordStudyDay();
    await saveProfileNote(r.profileNote || '', step ? step.topic : (lesson.topic || ''));
    await recordLesson({ topic: step ? `${stepLabel(step)}: ${step.title}` : lesson.topic, date: Date.now(), score: `${correct}/${total}` });
  } catch (err) {
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
    if (btn) btn.disabled = false;
  } finally {
    busy = false;
  }
}

async function render(container) {
  container.innerHTML = '<h1>Учебник</h1><p class="status">Открываю…</p>';
  await renderToc(container);
}

registerFeature({ id: 'teacher', title: 'Учебник', icon: '📘', order: 5, render });

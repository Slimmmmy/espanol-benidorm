import { registerFeature } from './app.js';
import { buildProfile, saveProfileNote, recordLesson, getCourse, saveCourse, markUnitDone, nextUnit } from './profile.js';
import { generateLesson, reviewLesson, generateCourse } from './claude.js';
import { escapeHtml } from './util.js';

const DEFAULT_GOAL = 'Разговорный бытовой испанский для повседневной жизни в районе Бенидорма';
let lesson = null;
let currentUnitId = null;
let busy = false;

function profileCard(profile, e) {
  return `<div class="study-card">
    <div class="word-ex">Уровень: <b>${e(profile.level)}</b> · выучено слов: <b>${profile.learned}</b> · уроков: <b>${profile.lessonsCompleted}</b></div>
    ${profile.note ? `<div class="word-local">📝 ${e(profile.note)}</div>` : ''}
  </div>`;
}

function exerciseHtml(ex, i) {
  const e = escapeHtml;
  if (ex.type === 'choice') {
    const opts = (ex.options || []).map((o, j) =>
      `<label class="opt-row"><input type="radio" name="ex${i}" value="${j}"> ${e(o)}</label>`).join('');
    return `<div class="lesson-ex"><div class="ex-prompt">${i + 1}. ${e(ex.prompt)}</div>${opts}</div>`;
  }
  return `<div class="lesson-ex"><div class="ex-prompt">${i + 1}. ${e(ex.prompt)}</div><textarea data-open="${i}" rows="2" placeholder="Твой ответ…"></textarea></div>`;
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

function renderLesson(container) {
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Урок: ${e(lesson.topic)}</h1>
    <div class="study-card"><div class="word-ex">${e(lesson.explanation)}</div></div>
    <div id="tch-ex">${(lesson.exercises || []).map((ex, i) => exerciseHtml(ex, i)).join('')}</div>
    <button id="tch-check">Проверить ответы</button>
    <button id="tch-cancel" class="danger">К программе</button>
    <p id="tch-status" class="status"></p>
    <div id="tch-results"></div>
  `;
  container.querySelector('#tch-check').onclick = () => checkLesson(container);
  container.querySelector('#tch-cancel').onclick = () => render(container);
}

async function checkLesson(container) {
  if (busy) return;
  busy = true;
  const status = container.querySelector('#tch-status');
  const answers = collectAnswers(container);
  if (status) status.textContent = 'Проверяю…';
  try {
    const r = await reviewLesson(lesson, answers);
    if (!container.querySelector('#tch-results')) return;
    if (status) status.textContent = '';
    const e = escapeHtml;
    const exCount = (lesson.exercises || []).length;
    const resList = (r.results || []).slice(0, exCount);
    const results = resList.map((res, i) =>
      `<div class="lesson-ex"><div class="${!!res.correct ? 'gr-ok' : 'gr-bad'}">${!!res.correct ? '✅' : '❌'} ${i + 1}</div><div class="word-ex">${e(res.comment || '')}</div></div>`).join('');
    const correct = resList.filter((x) => !!x.correct).length;
    const score = `${correct}/${exCount}`;
    container.querySelector('#tch-results').innerHTML = `
      ${results}
      <div class="study-card"><b>Итог: ${score}</b>
        <div class="word-ex">${e(r.summary || '')}</div>
        ${r.nextTopic ? `<div class="word-local">▶︎ Следующая тема: ${e(r.nextTopic)}</div>` : ''}
      </div>
      <button id="tch-back">К программе</button>
    `;
    await saveProfileNote(r.profileNote || '', lesson.topic);
    await recordLesson({ topic: lesson.topic, date: Date.now(), score });
    if (currentUnitId) await markUnitDone(currentUnitId, score);
    const back = container.querySelector('#tch-back');
    if (back) back.onclick = () => render(container);
  } catch (err) {
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function startLesson(container, topic, unitId) {
  if (busy) return;
  busy = true;
  currentUnitId = unitId || null;
  const status = container.querySelector('#tch-status');
  if (status) status.textContent = 'Готовлю урок под твой уровень…';
  try {
    const profile = await buildProfile();
    lesson = await generateLesson(profile, topic);
    if (!container.querySelector('#tch-status')) return;
    renderLesson(container);
  } catch (err) {
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function buildCourse(container) {
  if (busy) return;
  busy = true;
  const goalEl = container.querySelector('#tch-goal');
  const goal = (goalEl && goalEl.value.trim()) || DEFAULT_GOAL;
  const status = container.querySelector('#tch-status');
  if (status) status.textContent = 'Составляю программу под тебя…';
  try {
    const profile = await buildProfile();
    const gen = await generateCourse(profile, goal);
    const units = (gen.units || []).map((u, i) => ({
      id: `u${Date.now()}_${i}`, title: u.title || '', topic: u.topic || '', status: 'todo', score: '',
    }));
    await saveCourse({ goal, units, createdAt: Date.now() });
    if (!container.querySelector('#tch-status')) return;
    render(container);
  } catch (err) {
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function render(container) {
  container.innerHTML = '<h1>Учитель</h1><p class="status" id="tch-loading">Анализирую твой уровень…</p>';
  const profile = await buildProfile();
  if (!container.querySelector('#tch-loading')) return;
  const course = await getCourse();
  const e = escapeHtml;

  if (course && course.units && course.units.length) {
    const done = course.units.filter((u) => u.status === 'done').length;
    const total = course.units.length;
    const next = nextUnit(course.units);
    const unitsHtml = course.units.map((u, i) => {
      const isNext = next && u.id === next.id;
      const mark = u.status === 'done' ? '✅' : (isNext ? '▶︎' : '•');
      return `<div class="unit-row${isNext ? ' unit-next' : ''}">
        <span class="unit-mark">${mark}</span>
        <span class="unit-title">${i + 1}. ${e(u.title)}</span>
        ${u.score ? `<span class="unit-score">${e(u.score)}</span>` : ''}
      </div>`;
    }).join('');
    container.innerHTML = `<h1>Учитель</h1>${profileCard(profile, e)}
      <div class="study-card">
        <div class="word-ex">Программа: <b>${e(course.goal)}</b></div>
        <div class="daily-progress">Пройдено ${done}/${total}</div>
      </div>
      <div class="course-list">${unitsHtml}</div>
      ${next ? `<button id="tch-start">▶︎ Начать: ${e(next.title)}</button>`
             : '<p class="status">🎉 Курс пройден! Можно пересоставить программу или взять свободную тему.</p>'}
      <details class="tch-extra"><summary>Другое</summary>
        <label>Свободная тема урока<input id="tch-topic" type="text" placeholder="напр. прошедшее время"></label>
        <button id="tch-free">Свободный урок</button>
        <button id="tch-rebuild" class="danger">Пересоставить программу</button>
      </details>
      <p id="tch-status" class="status"></p>`;
    if (next) {
      container.querySelector('#tch-start').onclick = () => startLesson(container, next.topic, next.id);
    }
    container.querySelector('#tch-free').onclick = () => {
      const t = container.querySelector('#tch-topic').value.trim();
      if (t) startLesson(container, t, null);
    };
    container.querySelector('#tch-rebuild').onclick = () => buildCourse(container);
  } else {
    container.innerHTML = `<h1>Учитель</h1>${profileCard(profile, e)}
      <div class="study-card"><div class="word-ex">У тебя ещё нет программы. Составлю персональный курс под твой уровень и цель.</div></div>
      <label>Цель обучения<input id="tch-goal" type="text" value="${e(DEFAULT_GOAL)}"></label>
      <button id="tch-build">📚 Составить программу</button>
      <details class="tch-extra"><summary>Или сразу свободный урок</summary>
        <label>Тема<input id="tch-topic" type="text" placeholder="напр. артикли"></label>
        <button id="tch-free">Свободный урок</button>
      </details>
      <p id="tch-status" class="status"></p>`;
    container.querySelector('#tch-build').onclick = () => buildCourse(container);
    container.querySelector('#tch-free').onclick = () => {
      const t = container.querySelector('#tch-topic').value.trim();
      if (t) startLesson(container, t, null);
    };
  }
}

registerFeature({ id: 'teacher', title: 'Учитель', icon: '👨‍🏫', order: 5, render });

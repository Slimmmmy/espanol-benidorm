import { registerFeature } from './app.js';
import { buildProfile, saveProfileNote, recordLesson, pickNextTopic } from './profile.js';
import { generateLesson, reviewLesson } from './claude.js';
import { escapeHtml } from './util.js';

let lesson = null;

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
    <p id="tch-status" class="status"></p>
    <div id="tch-results"></div>
  `;
  container.querySelector('#tch-check').onclick = () => checkLesson(container);
}

async function checkLesson(container) {
  const status = container.querySelector('#tch-status');
  const btn = container.querySelector('#tch-check');
  if (btn) btn.disabled = true;
  const answers = collectAnswers(container);
  status.textContent = 'Проверяю…';
  try {
    const r = await reviewLesson(lesson, answers);
    if (!container.querySelector('#tch-results')) return;
    status.textContent = '';
    const e = escapeHtml;
    const exCount = (lesson.exercises || []).length;
    const resList = (r.results || []).slice(0, exCount);
    const results = resList.map((res, i) =>
      `<div class="lesson-ex"><div class="${!!res.correct ? 'gr-ok' : 'gr-bad'}">${!!res.correct ? '✅' : '❌'} ${i + 1}</div><div class="word-ex">${e(res.comment || '')}</div></div>`).join('');
    const total = exCount;
    const correct = resList.filter((x) => !!x.correct).length;
    container.querySelector('#tch-results').innerHTML = `
      ${results}
      <div class="study-card"><b>Итог: ${correct}/${total}</b>
        <div class="word-ex">${e(r.summary || '')}</div>
        ${r.nextTopic ? `<div class="word-local">▶︎ Следующая тема: ${e(r.nextTopic)}</div>` : ''}
      </div>
      <button id="tch-again">К началу</button>
    `;
    await saveProfileNote(r.profileNote || '', lesson.topic);
    await recordLesson({ topic: lesson.topic, date: Date.now(), score: `${correct}/${total}` });
    const again = container.querySelector('#tch-again');
    if (again) again.onclick = () => render(container);
  } catch (err) {
    if (btn) btn.disabled = false;
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  }
}

async function startLesson(container, topic) {
  const status = container.querySelector('#tch-status');
  const btn = container.querySelector('#tch-start');
  if (btn) btn.disabled = true;
  status.textContent = 'Готовлю урок под твой уровень…';
  try {
    const profile = await buildProfile();
    lesson = await generateLesson(profile, topic);
    if (!container.querySelector('#tch-status')) return;
    renderLesson(container);
  } catch (err) {
    if (btn) btn.disabled = false;
    const s = container.querySelector('#tch-status');
    if (s) s.textContent = err.message;
  }
}

async function render(container) {
  container.innerHTML = '<h1>Учитель</h1><p class="status" id="tch-loading">Анализирую твой уровень…</p>';
  const profile = await buildProfile();
  if (!container.querySelector('#tch-loading')) return;
  const e = escapeHtml;
  const recommended = pickNextTopic(profile.weak, profile.lastTopic);
  container.innerHTML = `
    <h1>Учитель</h1>
    <div class="study-card">
      <div class="word-ex">Уровень: <b>${e(profile.level)}</b> · выучено слов: <b>${profile.learned}</b> · уроков пройдено: <b>${profile.lessonsCompleted}</b></div>
      ${profile.note ? `<div class="word-local">📝 ${e(profile.note)}</div>` : ''}
    </div>
    <label>Тема следующего урока (рекомендована по твоим слабым местам)
      <input id="tch-topic" type="text" value="${e(recommended)}">
    </label>
    <button id="tch-start">Начать урок</button>
    <p id="tch-status" class="status"></p>
  `;
  container.querySelector('#tch-start').onclick = () => {
    const topic = container.querySelector('#tch-topic').value.trim() || recommended;
    startLesson(container, topic);
  };
}

registerFeature({ id: 'teacher', title: 'Учитель', icon: '👨‍🏫', order: 5, render });

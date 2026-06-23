import { registerFeature } from './app.js';
import { buildProfile, getAssignments, saveAssignments, partitionAssignments } from './profile.js';
import { generateAssignment, checkAssignment } from './claude.js';
import { escapeHtml } from './util.js';

let busy = false;

function openHtml(a) {
  const e = escapeHtml;
  return `<div class="word-card">
    <div class="word-main">📝 ${e(a.text)}</div>
    ${a.topic ? `<div class="word-local">📌 ${e(a.topic)}</div>` : ''}
    <textarea data-answer="${e(a.id)}" rows="3" placeholder="Твой ответ на испанском…"></textarea>
    <button data-submit="${e(a.id)}">Сдать на проверку</button>
    <div class="daily-feedback" data-fb="${e(a.id)}"></div>
  </div>`;
}

function doneHtml(a) {
  const e = escapeHtml;
  return `<div class="word-card">
    <div class="word-main">${a.ok ? '✅' : '☑️'} ${e(a.text)}</div>
    ${a.answer ? `<div class="word-ex">Твой ответ: ${e(a.answer)}</div>` : ''}
    ${a.feedback ? `<div class="word-ex">${e(a.feedback)}</div>` : ''}
  </div>`;
}

async function newAssignment(container) {
  if (busy) return;
  busy = true;
  const topicEl = container.querySelector('#asg-topic');
  const topic = topicEl ? topicEl.value.trim() : '';
  const status = container.querySelector('#asg-status');
  if (status) status.textContent = 'Готовлю задание…';
  try {
    const profile = await buildProfile();
    const a = await generateAssignment(profile, topic);
    const list = await getAssignments();
    list.push({ id: `a${Date.now()}`, text: a.text || '', topic: a.topic || topic || '', status: 'open', createdAt: Date.now() });
    await saveAssignments(list);
    if (!container.querySelector('#asg-list')) return;
    await render(container);
  } catch (err) {
    const s = container.querySelector('#asg-status');
    if (s) s.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function submit(container, id) {
  if (busy) return;
  const fb = container.querySelector(`[data-fb="${id}"]`);
  const ta = container.querySelector(`[data-answer="${id}"]`);
  const answer = ta ? ta.value.trim() : '';
  if (!answer) { if (fb) fb.textContent = 'Напиши ответ.'; return; }
  busy = true;
  if (fb) fb.textContent = 'Проверяю…';
  try {
    const list = await getAssignments();
    const a = list.find((x) => x.id === id);
    if (!a) return;
    const r = await checkAssignment(a.text, answer);
    a.status = 'done';
    a.answer = answer;
    a.feedback = r.feedback || '';
    a.ok = !!r.ok;
    a.doneAt = Date.now();
    await saveAssignments(list);
    if (!container.querySelector('#asg-list')) return;
    await render(container);
  } catch (err) {
    const box = container.querySelector(`[data-fb="${id}"]`);
    if (box) box.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function render(container) {
  container.innerHTML = '<h1>Задания</h1><p class="status" id="asg-loading">Загрузка…</p>';
  const list = await getAssignments();
  if (!container.querySelector('#asg-loading')) return;
  const { open, done } = partitionAssignments(list);
  container.innerHTML = `
    <h1>Задания</h1>
    <label>Тема (необязательно)<input id="asg-topic" type="text" placeholder="напр. заказ в баре"></label>
    <button id="asg-new">📝 Получить задание</button>
    <p id="asg-status" class="status"></p>
    <div id="asg-list">
      ${open.length ? `<h2>Текущие</h2>${open.map(openHtml).join('')}` : '<p class="status">Нет активных заданий. Нажми «Получить задание».</p>'}
      ${done.length ? `<details class="tch-extra"><summary>Выполненные (${done.length})</summary>${done.slice().reverse().map(doneHtml).join('')}</details>` : ''}
    </div>
  `;
  container.querySelector('#asg-new').onclick = () => newAssignment(container);
  container.querySelectorAll('[data-submit]').forEach((b) => { b.onclick = () => submit(container, b.dataset.submit); });
}

registerFeature({ id: 'assignments', title: 'Задания', icon: '📝', order: 45, render });

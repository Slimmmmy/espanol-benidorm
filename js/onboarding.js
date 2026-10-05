// Первое знакомство: три шага — ключ Claude → уровень → цель. Показывается на «Сегодня», пока не пройден.
import { getSetting, setSetting, getAllWords } from './db.js';
import { testConnection } from './claude.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const LEVELS = [
  { id: 'A0-A1', title: 'Начинаю', sub: 'Знаю отдельные слова и фразы' },
  { id: 'A2-B1', title: 'Объясняюсь', sub: 'Могу поговорить в магазине и баре' },
  { id: 'B2+', title: 'Говорю свободно', sub: 'Хочу звучать как местный' },
];
export const GOALS = [
  'Разговорный испанский для жизни в Бенидорме',
  'Общение с соседями и друзьями',
  'Работа, врачи и документы',
  'Читать книги в оригинале',
  'Сдать экзамен DELE',
];

export async function needsOnboarding() {
  if (await getSetting('onboarded')) return false;
  if (await getSetting('apiKey')) return false;
  return (await getAllWords()).length === 0;
}

function dots(i) {
  return `<div class="ob-dots" aria-label="Шаг ${i + 1} из 3">${[0, 1, 2].map((k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('')}</div>`;
}

// Шаг мастера переживает переход на тест уровня и обратно.
const stepStore = {
  get() { try { return Number(localStorage.getItem('obStep')) || 0; } catch (e) { return 0; } },
  set(v) { try { localStorage.setItem('obStep', String(v)); } catch (e) { /* необязательно */ } },
};

export function renderOnboarding(container, done) {
  const e = escapeHtml;
  let step = stepStore.get();
  const finish = async () => { stepStore.set(0); await setSetting('onboarded', true); done(); };

  const paint = async () => {
    stepStore.set(step);
    if (step === 0) {
      container.innerHTML = `<section class="onboarding">
        ${dots(0)}
        <div class="ob-hello es">¡Bienvenido!</div>
        <h1>Подключим преподавателя</h1>
        <p class="lead">Приложению нужен ваш ключ Claude — на нём работают уроки, сценки, перевод и проверка. Ключ хранится только на этом устройстве.</p>
        <label>Ключ Claude API
          <input id="ob-key" type="password" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off">
        </label>
        <details class="tch-extra"><summary>Где взять ключ</summary>
          <ol class="howto"><li>Откройте console.anthropic.com и войдите.</li><li>Пополните баланс на $5 — этого хватает надолго.</li><li>API Keys → Create Key → скопируйте ключ сюда.</li></ol>
        </details>
        <button id="ob-next" class="big">Проверить и дальше</button>
        <button id="ob-skip" class="ghost">Пропустить пока</button>
        <p id="ob-status" class="status" role="status"></p>
      </section>`;
      const status = container.querySelector('#ob-status');
      container.querySelector('#ob-skip').onclick = () => { step = 1; paint(); };
      container.querySelector('#ob-next').onclick = async () => {
        const key = container.querySelector('#ob-key').value.trim();
        if (!key) { status.textContent = 'Вставьте ключ или нажмите «Пропустить пока».'; return; }
        await setSetting('apiKey', key);
        status.textContent = 'Проверяю…';
        const r = await testConnection();
        if (!container.querySelector('#ob-status')) return;
        if (!r.ok) { status.textContent = r.message; return; }
        step = 1;
        paint();
      };
    } else if (step === 1) {
      const level = (await getSetting('level')) || '';
      container.innerHTML = `<section class="onboarding">
        ${dots(1)}
        <h1>Ваш уровень испанского</h1>
        <p class="lead">Под него подстроятся уроки, сценки и новые слова. Поменять можно в Настройках.</p>
        <div class="ob-options">${LEVELS.map((l) => `<button class="ob-option${l.id === level ? ' active' : ''}" data-level="${e(l.id)}"><b>${e(l.title)}</b><span>${e(l.id.replace('-', '–'))} · ${e(l.sub)}</span></button>`).join('')}</div>
        <button id="ob-test" class="ghost wide">Не знаю — пройти тест (5 минут)</button>
      </section>`;
      container.querySelector('#ob-test').onclick = () => { stepStore.set(2); location.hash = '#placement'; };
      container.querySelectorAll('[data-level]').forEach((b) => {
        b.onclick = async () => { await setSetting('level', b.dataset.level); step = 2; paint(); };
      });
    } else {
      container.innerHTML = `<section class="onboarding">
        ${dots(2)}
        <h1>Зачем вам испанский?</h1>
        <p class="lead">Из этого Учитель составит программу курса.</p>
        <div class="ob-options">${GOALS.map((g) => `<button class="ob-option" data-goal="${e(g)}"><b>${e(g)}</b></button>`).join('')}</div>
        <label>Или своими словами<input id="ob-goal" type="text" placeholder="напр. Говорить с семьёй жены"></label>
        <button id="ob-own" class="big">${icon('check', 'ic ic-sm')} Готово</button>
      </section>`;
      const save = async (g) => { if (g) await setSetting('goal', g); await finish(); };
      container.querySelectorAll('[data-goal]').forEach((b) => { b.onclick = () => save(b.dataset.goal); });
      container.querySelector('#ob-own').onclick = () => save(container.querySelector('#ob-goal').value.trim());
    }
  };
  paint();
}

import { registerFeature } from './app.js';
import { generateDailyWords, checkGrammar } from './claude.js';
import { getSetting, setSetting, getAllWords, putWord } from './db.js';
import { newCard } from './srs.js';
import { dayKey, recordStudyDay } from './stats.js';
import { speak } from './tts.js';
import { escapeHtml } from './util.js';

function todayKey() { return `daily-${dayKey(Date.now())}`; }

async function loadOrCreate(statusEl) {
  const k = todayKey();
  const existing = await getSetting(k);
  if (existing && Array.isArray(existing.words) && existing.words.length) return existing;
  statusEl.textContent = 'Подбираю 5 новых слов на сегодня…';
  const known = (await getAllWords()).map((w) => w.es).filter(Boolean);
  const data = await generateDailyWords(known);
  const words = (data.words || []).slice(0, 5).map((w) => ({
    es: w.es || '', ru: w.ru || '', example: w.example || '',
    exampleRu: w.exampleRu || '', local: w.local || '', added: false,
  }));
  const set = { date: dayKey(Date.now()), words };
  await setSetting(k, set);
  statusEl.textContent = '';
  return set;
}

function cardHtml(w, i) {
  const e = escapeHtml;
  return `
    <div class="word-card" data-i="${i}">
      <div class="word-main"><b>${e(w.es)}</b> — ${e(w.ru)}</div>
      ${w.example ? `<div class="word-ex">${e(w.example)}${w.exampleRu ? `<br><span class="muted">${e(w.exampleRu)}</span>` : ''}</div>` : ''}
      ${w.local ? `<div class="word-local">📍 ${e(w.local)}</div>` : ''}
      <div class="word-actions">
        <button data-say="${i}">🔊</button>
        ${w.added ? '<span class="daily-added">✓ в словаре</span>' : `<button data-add="${i}">Добавить в словарь</button>`}
        <button data-apply="${i}">Применить</button>
      </div>
      <div class="daily-apply hidden" data-applybox="${i}">
        <textarea data-sent="${i}" rows="2" placeholder="Составь предложение с этим словом…"></textarea>
        <button data-check="${i}">Проверить</button>
        <div class="daily-feedback" data-fb="${i}"></div>
      </div>
    </div>`;
}

async function render(container) {
  container.innerHTML = `<h1>5 слов на сегодня</h1><p id="dly-status" class="status">Загрузка…</p><div id="dly-list"></div>`;
  const status = container.querySelector('#dly-status');
  let set;
  try {
    set = await loadOrCreate(status);
  } catch (err) {
    const s = container.querySelector('#dly-status');
    if (s) s.textContent = err.message;
    return;
  }
  if (!container.querySelector('#dly-list')) return;

  function paint() {
    const added = set.words.filter((w) => w.added).length;
    status.innerHTML = `<span class="daily-progress">Добавлено ${added}/5</span>`;
    container.querySelector('#dly-list').innerHTML = set.words.map((w, i) => cardHtml(w, i)).join('');
    wire();
  }

  function wire() {
    const list = container.querySelector('#dly-list');
    list.querySelectorAll('[data-say]').forEach((b) => {
      b.onclick = () => speak(set.words[Number(b.dataset.say)].es);
    });
    list.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = async () => {
        const i = Number(b.dataset.add);
        const w = set.words[i];
        const now = Date.now();
        await putWord({ es: w.es, ru: w.ru, example: w.example, exampleRu: w.exampleRu, local: w.local, createdAt: now, ...newCard(now) });
        await recordStudyDay();
        w.added = true;
        await setSetting(todayKey(), set);
        if (!container.querySelector('#dly-list')) return;
        paint();
      };
    });
    list.querySelectorAll('[data-apply]').forEach((b) => {
      b.onclick = () => {
        const box = list.querySelector(`[data-applybox="${b.dataset.apply}"]`);
        if (box) box.classList.toggle('hidden');
      };
    });
    list.querySelectorAll('[data-check]').forEach((b) => {
      b.onclick = async () => {
        const i = b.dataset.check;
        const ta = list.querySelector(`[data-sent="${i}"]`);
        const fb = list.querySelector(`[data-fb="${i}"]`);
        const sentence = ta.value.trim();
        if (!sentence) return;
        fb.textContent = 'Проверяю…';
        try {
          const r = await checkGrammar(sentence);
          const box = list.querySelector(`[data-fb="${i}"]`);
          if (!box) return;
          const e = escapeHtml;
          box.innerHTML = `
            <div class="${r.ok ? 'gr-ok' : 'gr-bad'}">${r.ok ? '✅ Верно' : '✏️ Поправим'}</div>
            ${r.corrected ? `<div class="word-ex"><b>${e(r.corrected)}</b></div>` : ''}
            ${r.explanation ? `<div class="word-ex">${e(r.explanation)}</div>` : ''}`;
        } catch (err) {
          const box = list.querySelector(`[data-fb="${i}"]`);
          if (box) box.textContent = err.message;
        }
      };
    });
  }

  paint();
}

registerFeature({ id: 'daily', title: '5 слов', icon: '🗓️', order: 15, render });

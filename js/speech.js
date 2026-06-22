import { registerFeature } from './app.js';
import { recognizeOnce } from './asr.js';
import { gradeSpeech } from './claude.js';
import { speak } from './tts.js';
import { similarity, escapeHtml } from './util.js';

const PHRASES = [
  'El perro de San Roque no tiene rabo.',
  'Tres tristes tigres tragaban trigo en un trigal.',
  'Quiero una caña y una tapa, por favor.',
  'La zapatería está cerca de la plaza.',
  'Me llamo Pablo y vivo cerca de Benidorm.',
  'El cielo está despejado y hace calor.',
];
let idx = 0;

function scoreLabel(s) {
  if (s >= 0.85) return '🟢 Отлично';
  if (s >= 0.6) return '🟡 Неплохо';
  return '🔴 Стоит поработать';
}

async function render(container) {
  const e = escapeHtml;
  container.innerHTML = `
    <h1>Логопед</h1>
    <div class="study-card">
      <div class="study-es"><b id="sp-phrase">${e(PHRASES[idx])}</b></div>
      <div class="dlg-controls">
        <button id="sp-listen">🔊 Образец</button>
        <button id="sp-rec">🎤 Говорить</button>
        <button id="sp-next">Другая фраза</button>
      </div>
      <p id="sp-status" class="status"></p>
      <div id="sp-result"></div>
    </div>
    <p class="status">Распознавание речи лучше всего работает в Chrome. Разреши доступ к микрофону.</p>
  `;
  const phraseEl = container.querySelector('#sp-phrase');
  const status = container.querySelector('#sp-status');
  const result = container.querySelector('#sp-result');

  container.querySelector('#sp-listen').onclick = () => speak(PHRASES[idx]);
  container.querySelector('#sp-next').onclick = () => {
    idx = (idx + 1) % PHRASES.length;
    phraseEl.textContent = PHRASES[idx];
    status.textContent = '';
    result.innerHTML = '';
  };
  container.querySelector('#sp-rec').onclick = async () => {
    status.textContent = 'Слушаю… говори сейчас';
    result.innerHTML = '';
    try {
      const heard = await recognizeOnce();
      const target = PHRASES[idx];
      const s = similarity(target, heard);
      if (!container.querySelector('#sp-result')) return;
      status.textContent = '';
      result.innerHTML = `
        <div class="sp-score">${scoreLabel(s)} — разборчивость ${Math.round(s * 100)}%</div>
        <div class="word-ex">Распозналось: «${e(heard)}»</div>
        <button id="sp-coach">Разбор от логопеда</button>
        <div id="sp-coaching"></div>`;
      result.querySelector('#sp-coach').onclick = async () => {
        const coaching = container.querySelector('#sp-coaching');
        coaching.innerHTML = '<p class="status">Анализирую…</p>';
        try {
          const c = await gradeSpeech(target, heard);
          const box = container.querySelector('#sp-coaching');
          if (!box) return;
          box.innerHTML = `
            ${c.sounds ? `<div class="word-ex">🗣️ ${e(c.sounds)}</div>` : ''}
            ${c.rhythm ? `<div class="word-ex">🎵 ${e(c.rhythm)}</div>` : ''}
            ${c.exercise ? `<div class="word-local">🏋️ ${e(c.exercise)}</div>` : ''}`;
        } catch (err) {
          const box = container.querySelector('#sp-coaching');
          if (box) box.innerHTML = `<p class="status">${e(err.message)}</p>`;
        }
      };
    } catch (err) {
      const s2 = container.querySelector('#sp-status');
      if (s2) s2.textContent = err.message;
    }
  };
}

registerFeature({ id: 'speech', title: 'Логопед', icon: '🗣️', order: 35, render });

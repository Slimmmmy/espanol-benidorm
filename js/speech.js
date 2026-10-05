// «Логопед»: три режима — пары звуков (на слух), повтор за голосом (shadowing) и разбор фразы ИИ.
import { registerFeature } from './app.js';
import { recognizeOnce, canRecognize } from './asr.js';
import { gradeSpeech } from './claude.js';
import { speak, speakAndWait } from './tts.js';
import { similarity, escapeHtml } from './util.js';
import { diffWords } from './exercises.js';
import { recordActivity } from './activity.js';
import { PAIR_GROUPS, SHADOW, phoneticTips, pairQuestion } from './phonetics.js';
import { icon } from './icons.js';

const PHRASES = [
  'El perro de San Roque no tiene rabo.',
  'Tres tristes tigres tragaban trigo en un trigal.',
  'Quiero una caña y una tapa, por favor.',
  'La zapatería está cerca de la plaza.',
  'Me llamo Pablo y vivo cerca de Benidorm.',
  'El cielo está despejado y hace calor.',
];
const MODES = [
  { id: 'pairs', title: 'Пары звуков' },
  { id: 'shadow', title: 'За голосом' },
  { id: 'coach', title: 'Разбор фразы' },
];
let mode = 'pairs';
let groupId = 'r';
let shadowIdx = 0;
let coachIdx = 0;

function scoreLabel(s) {
  if (s >= 0.85) return 'Отлично';
  if (s >= 0.6) return 'Неплохо';
  return 'Стоит поработать';
}

function tipsHtml(phrase) {
  const tips = phoneticTips(phrase);
  return tips.length ? `<ul class="tips">${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
}

// ── Пары звуков: слушаете слово и выбираете, какое из двух прозвучало ──
function renderPairs(box) {
  const e = escapeHtml;
  const g = PAIR_GROUPS.find((x) => x.id === groupId) || PAIR_GROUPS[0];
  let score = 0;
  let total = 0;
  let q = null;
  box.innerHTML = `
    <div class="chip-row" role="group" aria-label="Звуки">${PAIR_GROUPS.map((x) => `<button type="button" class="chip-btn${x.id === g.id ? ' active' : ''}" data-group="${x.id}" aria-pressed="${x.id === g.id}">${e(x.title)}</button>`).join('')}</div>
    <div class="word-local">${e(g.tip)}</div>
    <div class="study-card drill-card">
      <div class="pair-score" id="pp-score" role="status">Нажмите «Слушать» и выберите, какое слово прозвучало.</div>
      <button id="pp-play" class="big">${icon('sound', 'ic ic-sm')} Слушать</button>
      <div class="gender-row" id="pp-opts"></div>
      <div id="pp-fb"></div>
    </div>
    <details class="tch-extra"><summary>Все пары этой группы</summary>
      <div class="pair-list">${g.pairs.map(([a, b]) => `<div class="rp-word"><span lang="es"><b>${e(a)}</b> — ${e(g.ru[a] || '')}</span><button class="mini" data-say="${e(a)}" aria-label="Озвучить ${e(a)}">${icon('sound', 'ic ic-sm')}</button></div>
        <div class="rp-word"><span lang="es"><b>${e(b)}</b> — ${e(g.ru[b] || '')}</span><button class="mini" data-say="${e(b)}" aria-label="Озвучить ${e(b)}">${icon('sound', 'ic ic-sm')}</button></div>`).join('')}</div>
    </details>`;
  box.querySelectorAll('[data-group]').forEach((b) => { b.onclick = () => { groupId = b.dataset.group; renderPairs(box); }; });
  box.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
  const opts = box.querySelector('#pp-opts');
  const next = () => {
    q = pairQuestion(g);
    box.querySelector('#pp-fb').innerHTML = '';
    opts.innerHTML = q.pair.map((w, k) => `<button type="button" class="ghost" data-k="${k}" lang="es">${e(w)}</button>`).join('');
    opts.querySelectorAll('[data-k]').forEach((b) => {
      b.onclick = () => {
        const ok = Number(b.dataset.k) === q.answer;
        total++;
        if (ok) score++;
        opts.querySelectorAll('[data-k]').forEach((x) => {
          x.disabled = true;
          if (Number(x.dataset.k) === q.answer) x.classList.add('right');
          else if (x === b) x.classList.add('wrong');
        });
        box.querySelector('#pp-score').textContent = `Верно: ${score} из ${total}`;
        box.querySelector('#pp-fb').innerHTML = `
          <div class="${ok ? 'gr-ok' : 'gr-bad'}">${ok ? `${icon('check', 'ic ic-sm')}Верно!` : 'Не совсем'} — прозвучало «${e(q.word)}» (${e(g.ru[q.word] || '')})</div>
          <div class="word-actions"><button class="ghost" id="pp-a" lang="es">${icon('sound', 'ic ic-sm')} ${e(q.pair[0])}</button><button class="ghost" id="pp-b" lang="es">${icon('sound', 'ic ic-sm')} ${e(q.pair[1])}</button></div>
          <button id="pp-next" class="big">Следующее слово</button>`;
        box.querySelector('#pp-a').onclick = () => speak(q.pair[0]);
        box.querySelector('#pp-b').onclick = () => speak(q.pair[1]);
        box.querySelector('#pp-next').onclick = () => { next(); speak(q.word); };
        if (total === 5) recordActivity('speech');
      };
    });
  };
  next();
  box.querySelector('#pp-play').onclick = () => speak(q.word);
}

// ── Повтор за голосом: медленный образец → сразу говорите сами → сравнение по словам ──
function renderShadow(box) {
  const e = escapeHtml;
  const phrase = SHADOW[shadowIdx % SHADOW.length];
  box.innerHTML = `
    <p class="status">Послушайте фразу и сразу повторите за голосом — с той же мелодией и темпом. Микрофон включится сам.</p>
    <div class="study-card">
      <div class="study-es" lang="es"><b>${e(phrase)}</b></div>
      ${tipsHtml(phrase)}
      <div class="dlg-controls">
        <button id="sh-go" class="primary">${icon('play', 'ic ic-sm')} Слушать и повторить</button>
        <button id="sh-slow" class="ghost">Медленно 0.7×</button>
        <button id="sh-next" class="ghost">Другая фраза</button>
      </div>
      <p id="sh-status" class="status" role="status"></p>
      <div id="sh-result"></div>
    </div>`;
  const status = box.querySelector('#sh-status');
  const result = box.querySelector('#sh-result');
  const run = async (slow) => {
    result.innerHTML = '';
    status.textContent = 'Слушайте…';
    await speakAndWait(phrase, 'es-ES', { slow });
    if (!box.isConnected) return;
    if (!canRecognize()) { status.textContent = 'Распознавание речи недоступно в этом браузере — повторите вслух сами.'; return; }
    status.textContent = 'Теперь вы — говорите!';
    try {
      const heard = await recognizeOnce('es-ES');
      if (!box.isConnected) return;
      const d = diffWords(phrase, heard);
      const s = similarity(phrase, heard);
      status.textContent = '';
      result.innerHTML = `
        <div class="sp-score">${scoreLabel(s)} — совпало слов: ${d.correct} из ${d.total}</div>
        <div class="dict-res" lang="es">${d.tokens.map((t) => `<span class="${t.ok ? 'w-ok' : 'w-bad'}">${e(t.w)}</span>`).join(' ')}</div>
        <div class="word-ex">Распозналось: «${e(heard)}»</div>`;
      recordActivity('speech');
    } catch (err) {
      if (box.isConnected) status.textContent = err.message;
    }
  };
  box.querySelector('#sh-go').onclick = () => run(false);
  box.querySelector('#sh-slow').onclick = () => run(true);
  box.querySelector('#sh-next').onclick = () => { shadowIdx++; renderShadow(box); };
}

// ── Разбор фразы ИИ-логопедом (как раньше) ──
function renderCoach(box) {
  const e = escapeHtml;
  box.innerHTML = `
    <div class="study-card">
      <div class="study-es"><b id="sp-phrase" lang="es">${e(PHRASES[coachIdx])}</b></div>
      ${tipsHtml(PHRASES[coachIdx])}
      <div class="dlg-controls">
        <button id="sp-listen">${icon('sound', 'ic ic-sm')} Образец</button>
        <button id="sp-rec">${icon('mic', 'ic ic-sm')} Говорить</button>
        <button id="sp-next">Другая фраза</button>
      </div>
      <p id="sp-status" class="status"></p>
      <div id="sp-result"></div>
    </div>`;
  const status = box.querySelector('#sp-status');
  const result = box.querySelector('#sp-result');
  box.querySelector('#sp-listen').onclick = () => speak(PHRASES[coachIdx]);
  box.querySelector('#sp-next').onclick = () => { coachIdx = (coachIdx + 1) % PHRASES.length; renderCoach(box); };
  box.querySelector('#sp-rec').onclick = async () => {
    status.textContent = 'Слушаю… говорите сейчас';
    result.innerHTML = '';
    try {
      const target = PHRASES[coachIdx];
      const heard = await recognizeOnce();
      const s = similarity(target, heard);
      recordActivity('speech');
      if (!box.isConnected) return;
      status.textContent = '';
      result.innerHTML = `
        <div class="sp-score">${scoreLabel(s)} — разборчивость ${Math.round(s * 100)}%</div>
        <div class="word-ex">Распозналось: «${e(heard)}»</div>
        <button id="sp-coach">Разбор от логопеда</button>
        <div id="sp-coaching"></div>`;
      result.querySelector('#sp-coach').onclick = async () => {
        const coaching = box.querySelector('#sp-coaching');
        coaching.innerHTML = '<p class="status">Анализирую…</p>';
        try {
          const c = await gradeSpeech(target, heard);
          if (!coaching.isConnected) return;
          coaching.innerHTML = `
            ${c.sounds ? `<div class="word-ex"><b>Звуки:</b> ${e(c.sounds)}</div>` : ''}
            ${c.rhythm ? `<div class="word-ex"><b>Ритм:</b> ${e(c.rhythm)}</div>` : ''}
            ${c.exercise ? `<div class="word-local"><b>Упражнение:</b> ${e(c.exercise)}</div>` : ''}`;
        } catch (err) {
          if (coaching.isConnected) coaching.innerHTML = `<p class="status">${e(err.message)}</p>`;
        }
      };
    } catch (err) {
      if (status.isConnected) status.textContent = err.message;
    }
  };
}

async function render(container) {
  container.innerHTML = `
    <h1>Логопед</h1>
    <div class="segment seg-inline" role="tablist" aria-label="Режим">${MODES.map((m) => `<button type="button" role="tab" class="seg-btn${m.id === mode ? ' active' : ''}" aria-selected="${m.id === mode}" data-mode="${m.id}">${m.title}</button>`).join('')}</div>
    <div id="sp-box"></div>
    <p class="status">Распознавание речи лучше всего работает в Chrome и Safari. Разрешите доступ к микрофону.</p>`;
  const box = container.querySelector('#sp-box');
  const paint = () => {
    container.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-selected', String(b.dataset.mode === mode)); });
    if (mode === 'pairs') renderPairs(box);
    else if (mode === 'shadow') renderShadow(box);
    else renderCoach(box);
  };
  container.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; paint(); }; });
  paint();
}

registerFeature({ id: 'speech', title: 'Логопед', icon: '🗣️', order: 35, render });

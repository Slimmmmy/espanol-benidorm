// «Истории из ваших слов»: короткий рассказ о жизни в Бенидорме, где почти все слова уже знакомы,
// а 2–3 новых взяты из частотного словаря. Понятное чтение + озвучка + вопрос на понимание.
import { registerFeature } from './app.js';
import { getSetting, setSetting, getVocab } from './db.js';
import { generateStory } from './claude.js';
import { nextFrequent } from './freq.js';
import { speak, speakSequence, stopSpeaking } from './tts.js';
import { enableWordPick, saveWord, findExistingWord } from './wordpick.js';
import { recordActivity } from './activity.js';
import { recordStudyDay } from './stats.js';
import { escapeHtml, stagedStatus } from './util.js';
import { icon } from './icons.js';

export const STORY_TOPICS = ['Пляж', 'Бар и тапас', 'Соседи', 'Рынок', 'Поездка в Altea', 'Работа', 'Праздник'];
const KEEP = 20;

// Знакомые слова для промпта: сначала самые выученные. Чистая функция.
export function knownForStory(vocab, n = 300) {
  return [...(vocab || [])]
    .sort((a, b) => (b.reps || 0) - (a.reps || 0))
    .map((w) => String(w.es || '').replace(/^(el|la|los|las)\s+/i, ''))
    .filter(Boolean)
    .slice(0, n);
}

// Ответ модели → безопасная структура.
export function normalizeStory(r) {
  const paragraphs = (Array.isArray(r && r.paragraphs) ? r.paragraphs : []).map(String).filter(Boolean);
  const translation = (Array.isArray(r && r.translation) ? r.translation : []).map(String);
  const options = Array.isArray(r && r.options) ? r.options.map(String) : [];
  return {
    title: String((r && r.title) || 'Una historia'),
    paragraphs,
    translation: paragraphs.map((_, i) => translation[i] || ''),
    newWords: (Array.isArray(r && r.newWords) ? r.newWords : []).filter((w) => w && w.es),
    question: String((r && r.question) || ''),
    options,
    answer: Number.isInteger(r && r.answer) && r.answer >= 0 && r.answer < options.length ? r.answer : 0,
  };
}

let current = null;
let busy = false;

async function getStories() { return (await getSetting('stories')) || []; }

async function create(container, topic) {
  if (busy) return;
  busy = true;
  const status = container.querySelector('#st-status');
  const stop = stagedStatus(status, ['Подбираю знакомые слова…', 'Пишу историю…', 'Перевожу и готовлю вопрос…'], 7000);
  try {
    const vocab = await getVocab();
    const level = (await getSetting('level')) || 'A2-B1';
    const fresh = nextFrequent(vocab, 3);
    const r = normalizeStory(await generateStory({ level, known: knownForStory(vocab), fresh, topic }));
    stop();
    if (!r.paragraphs.length) throw new Error('История не получилась. Попробуйте ещё раз.');
    const story = { id: `s${Date.now()}`, date: Date.now(), topic, ...r, answered: null };
    const list = await getStories();
    list.push(story);
    await setSetting('stories', list.slice(-KEEP));
    current = story;
    if (container.dataset.screen === 'stories') renderStory(container);
  } catch (err) {
    stop();
    if (status && status.isConnected) status.textContent = err.message;
  } finally {
    busy = false;
  }
}

async function saveAnswer(story) {
  const list = await getStories();
  const i = list.findIndex((s) => s.id === story.id);
  if (i >= 0) { list[i] = story; await setSetting('stories', list); }
}

async function renderStory(container) {
  const e = escapeHtml;
  const s = current;
  const vocab = await getVocab();
  container.innerHTML = `
    <button id="st-back" class="ghost">${icon('back', 'ic ic-sm')} Все истории</button>
    <h1 lang="es" class="es">${e(s.title)}</h1>
    <div class="dlg-controls">
      <button id="st-play">${icon('play', 'ic ic-sm')} Слушать</button>
      <button id="st-slow">Медленно 0.7×</button>
      <button id="st-stop" aria-label="Остановить">${icon('close', 'ic ic-sm')}</button>
      <button id="st-tr" class="ghost">Перевод</button>
    </div>
    <div class="study-card story-text" id="st-text">${s.paragraphs.map((p, i) => `
      <p class="story-p" lang="es">${e(p)}</p>
      <p class="story-ru muted hidden" data-ru="${i}">${e(s.translation[i])}</p>`).join('')}
    </div>
    <p class="status">Нажмите на любое слово — перевод и «＋ в словарь».</p>
    ${s.newWords.length ? `<h2>Новые слова</h2>${s.newWords.map((w, i) => {
      const have = !!findExistingWord(vocab, w.es);
      return `<div class="rp-word"><span><b lang="es">${e(w.es)}</b> — ${e(w.ru)}</span>
        <span><button class="mini" data-wsay="${i}" aria-label="Озвучить">${icon('sound', 'ic ic-sm')}</button>${have ? '<span class="daily-added">✓</span>' : `<button class="mini" data-wadd="${i}" aria-label="Добавить в словарь">＋</button>`}</span></div>`;
    }).join('')}` : ''}
    ${s.question ? `<h2>Вопрос</h2>
      <div class="study-card"><p>${e(s.question)}</p>
        <div class="ob-options">${s.options.map((o, i) => `<button type="button" class="ob-option" data-q="${i}"><b>${e(o)}</b></button>`).join('')}</div>
        <div id="st-qfb"></div></div>` : ''}`;
  const q = (sel) => container.querySelector(sel);
  enableWordPick(q('#st-text'));
  const lines = s.paragraphs.map((p) => ({ es: p, speaker: '' }));
  q('#st-back').onclick = () => { stopSpeaking(); current = null; render(container); };
  q('#st-play').onclick = () => speakSequence(lines);
  q('#st-slow').onclick = () => speakSequence(lines, 'es-ES', { slow: true });
  q('#st-stop').onclick = () => stopSpeaking();
  q('#st-tr').onclick = () => container.querySelectorAll('.story-ru').forEach((el) => el.classList.toggle('hidden'));
  container.querySelectorAll('[data-wsay]').forEach((b) => { b.onclick = () => speak(s.newWords[Number(b.dataset.wsay)].es); });
  container.querySelectorAll('[data-wadd]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      const w = s.newWords[Number(b.dataset.wadd)];
      const r = await saveWord({ es: w.es, ru: w.ru, example: w.example || '', source: 'story', local: `Из истории «${s.title}»` });
      b.outerHTML = `<span class="daily-added">${r === 'added' ? '✓' : '✓ уже есть'}</span>`;
    };
  });
  const showAnswer = (picked) => {
    container.querySelectorAll('[data-q]').forEach((b) => {
      const k = Number(b.dataset.q);
      b.disabled = true;
      if (k === s.answer) b.classList.add('right');
      else if (k === picked) b.classList.add('wrong');
    });
    q('#st-qfb').innerHTML = picked === s.answer
      ? `<div class="gr-ok" role="status">${icon('check', 'ic ic-sm')}Верно! ¡Muy bien!</div>`
      : '<div class="gr-bad" role="status">Не совсем — перечитайте историю ещё раз.</div>';
  };
  if (s.answered != null) showAnswer(s.answered);
  container.querySelectorAll('[data-q]').forEach((b) => {
    b.onclick = async () => {
      if (s.answered != null) return;
      s.answered = Number(b.dataset.q);
      showAnswer(s.answered);
      await saveAnswer(s);
      await recordActivity('story');
      await recordStudyDay();
    };
  });
}

async function render(container) {
  if (current) { renderStory(container); return; }
  const e = escapeHtml;
  const list = (await getStories()).slice().reverse();
  const vocab = await getVocab();
  container.innerHTML = `
    <h1>Истории</h1>
    <p class="lead">Короткий рассказ о жизни в Бенидорме из слов, которые вы уже знаете, плюс 2–3 новых частых слова. Читайте, слушайте, отвечайте на вопрос.</p>
    ${vocab.length < 30 ? '<p class="status">В словаре пока мало слов — история будет совсем простой. Чем больше слов, тем интереснее.</p>' : ''}
    <div class="chip-row" role="group" aria-label="Тема">${STORY_TOPICS.map((t) => `<button type="button" class="chip-btn" data-topic="${e(t)}">${e(t)}</button>`).join('')}</div>
    <button id="st-new" class="big">${icon('reader', 'ic ic-sm')} Новая история</button>
    <p id="st-status" class="status" role="status"></p>
    ${list.length ? `<h2>Прочитанные</h2>${list.map((s) => `<button type="button" class="td-card" data-open="${e(s.id)}">
      <span class="td-icon">${icon(s.answered != null ? 'check' : 'reader')}</span>
      <span class="td-text"><span class="td-title" lang="es">${e(s.title)}</span><span class="td-sub">${e([s.topic, new Date(s.date).toLocaleDateString('ru-RU')].filter(Boolean).join(' · '))}</span></span>
    </button>`).join('')}` : ''}`;
  let topic = '';
  container.querySelectorAll('[data-topic]').forEach((b) => {
    b.onclick = () => {
      topic = topic === b.dataset.topic ? '' : b.dataset.topic;
      container.querySelectorAll('[data-topic]').forEach((x) => { x.classList.toggle('active', x.dataset.topic === topic); x.setAttribute('aria-pressed', String(x.dataset.topic === topic)); });
    };
  });
  container.querySelector('#st-new').onclick = () => create(container, topic);
  container.querySelectorAll('[data-open]').forEach((b) => {
    b.onclick = () => { current = list.find((s) => s.id === b.dataset.open); renderStory(container); };
  });
}

registerFeature({ id: 'stories', title: 'Истории', icon: '📗', order: 23, render });

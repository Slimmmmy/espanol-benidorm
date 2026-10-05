// «Напоминания»: настоящие push-уведомления на iPhone (iOS 16.4+, приложение на экране «Домой»).
// Утром — сколько карточек ждёт и серия; вечером — если ещё не занимались. Отправляет GitHub Actions
// (scripts/remind.mjs) по секрету PUSH_CONFIG, который формируется здесь. Ключи VAPID создаются на телефоне.
import { registerFeature } from './app.js';
import { getSetting, setSetting } from './db.js';
import { getSyncConfig, getRow, putRow } from './sync.js';
import { downloadReminder } from './reminders.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

const REPO = 'Slimmmmy/espanol-benidorm';
const APP_URL = 'https://slimmmmy.github.io/espanol-benidorm/';

export const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function fromB64url(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

// Секрет для GitHub: доступ к своей строке Supabase + ключи VAPID. Чистая функция.
export function buildPushConfig(sync, vapid) {
  return JSON.stringify({ v: 1, url: sync.url, key: sync.key, code: sync.code, vapid, subject: APP_URL });
}

export const isStandalone = () => typeof window !== 'undefined'
  && ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function ensureVapid() {
  let v = await getSetting('vapid');
  if (v && v.publicKey && v.privateKey) return v;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  v = { publicKey: b64url(pub), privateKey: jwk.d };
  await setSetting('vapid', v);
  return v;
}

async function prefs() {
  return {
    morning: (await getSetting('pushMorning')) || '08:30',
    evening: (await getSetting('pushEvening')) || '20:30',
    eveningOn: (await getSetting('pushEveningOn')) !== false,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
  };
}

// Подписаться (или взять текущую подписку) и сохранить её вместе со временем в Supabase.
async function subscribeAndSave() {
  const sync = await getSyncConfig();
  if (!sync.url || !sync.key || !sync.code) throw new Error('Сначала настройте синхронизацию (Supabase) в Настройках.');
  const vapid = await ensureVapid();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const key = sub.options && sub.options.applicationServerKey;
    if (key && b64url(new Uint8Array(key)) !== vapid.publicKey) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(vapid.publicKey) });
  await putRow(sync, `${sync.code}:push`, { subscription: sub.toJSON(), ...(await prefs()), updatedAt: Date.now() });
  await setSetting('pushEndpoint', sub.endpoint);
  return { sync, vapid };
}

// При запуске: если уведомления включены и подписка сменилась (iOS иногда её обновляет) — сохранить новую.
export async function refreshPushSubscription() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const saved = await getSetting('pushEndpoint');
    if (!saved) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub || sub.endpoint !== saved) await subscribeAndSave();
  } catch (e) { /* тихо: попробуем в следующий раз */ }
}

function step(done, title, body) {
  return `<div class="ntf-step${done ? ' done' : ''}"><span class="goal-check">${done ? icon('check') : ''}</span><div><b>${title}</b>${body ? `<div class="muted">${body}</div>` : ''}</div></div>`;
}

async function render(container) {
  const e = escapeHtml;
  const sync = await getSyncConfig();
  const p = await prefs();
  const syncOk = !!(sync.url && sync.key && sync.code);
  const standalone = isStandalone();
  const supported = pushSupported();
  const perm = supported ? Notification.permission : 'unsupported';
  const endpoint = await getSetting('pushEndpoint');
  const vapid = await getSetting('vapid');
  let state = null;
  if (syncOk && endpoint) { try { state = await getRow(sync, `${sync.code}:push-state`); } catch (err) { /* нет сети */ } }
  const ready = perm === 'granted' && !!endpoint;

  container.innerHTML = `
    <h1>Напоминания</h1>
    <p class="lead">Каждое утро — сообщение: сколько карточек ждёт, ваша серия и фраза дня. Вечером — напоминание, если ещё не занимались.</p>
    <div class="ntf-steps">
      ${step(standalone, 'Приложение на экране «Домой»', standalone ? '' : 'На iPhone уведомления приходят только приложению с экрана «Домой»: Safari → «Поделиться» → «На экран Домой», и откройте оттуда.')}
      ${step(syncOk, 'Синхронизация настроена', syncOk ? '' : 'Нужна, чтобы напоминание знало ваш прогресс. Настройки → «Синхронизация».')}
      ${step(ready, 'Уведомления разрешены', perm === 'denied' ? 'Запрещены в iPhone: Настройки → Уведомления → Español → Разрешить.' : '')}
      ${step(ready && state && state.lastSent, 'Первое напоминание пришло', state && state.lastSent ? `Последнее: ${e(new Date(state.lastSent).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}` : '')}
    </div>

    <h2>Когда писать</h2>
    <label>Утром
      <input id="ntf-morning" type="time" value="${e(p.morning)}">
    </label>
    <label class="check-row"><input id="ntf-evening-on" type="checkbox"${p.eveningOn ? ' checked' : ''}> Вечером, если ещё не занимался</label>
    <label>Вечером
      <input id="ntf-evening" type="time" value="${e(p.evening)}">
    </label>
    <p class="status">Часовой пояс: ${e(p.tz)}. Сообщение может прийти с опозданием до получаса.</p>

    ${supported ? `<button id="ntf-enable" class="big">${icon('check', 'ic ic-sm')} ${ready ? 'Сохранить время' : 'Включить уведомления'}</button>` : '<p class="gr-bad">Этот браузер не поддерживает уведомления. На iPhone нужна iOS 16.4+ и приложение с экрана «Домой».</p>'}
    <button id="ntf-sample" class="ghost wide">Показать пример уведомления</button>
    <p id="ntf-status" class="status" role="status"></p>

    ${ready && vapid ? `<h2>Последний шаг — один раз</h2>
    <div class="word-card">
      <p>Сообщения отправляет GitHub (там живёт приложение). Добавьте ему ключ:</p>
      <ol class="howto">
        <li>Нажмите «Скопировать ключ».</li>
        <li>Откройте <a href="https://github.com/${REPO}/settings/secrets/actions/new" target="_blank" rel="noopener">GitHub → Settings → Secrets → New secret</a>.</li>
        <li>Name: <b>PUSH_CONFIG</b>, Secret: вставьте ключ → «Add secret».</li>
        <li>Проверка: <a href="https://github.com/${REPO}/actions/workflows/remind.yml" target="_blank" rel="noopener">Actions → remind</a> → «Run workflow» — через минуту придёт тестовое уведомление.</li>
      </ol>
      <button id="ntf-copy">${icon('plus', 'ic ic-sm')} Скопировать ключ</button>
      <details class="tch-extra"><summary>Показать ключ</summary><textarea id="ntf-secret" rows="5" readonly>${e(buildPushConfig(sync, vapid))}</textarea></details>
      <p class="status">В ключе — доступ к вашей строке синхронизации и ключ подписи уведомлений. Не публикуйте его; в секретах GitHub он хранится скрыто.</p>
    </div>` : ''}

    <h2>Без интернета</h2>
    <p class="status">Запасной вариант: ежедневное событие в календаре iPhone с напоминанием (текст всегда одинаковый).</p>
    <button id="ntf-ics" class="ghost">📅 Добавить в календарь на ${e(p.morning)}</button>`;

  const q = (s) => container.querySelector(s);
  const status = q('#ntf-status');
  const savePrefs = async () => {
    await setSetting('pushMorning', q('#ntf-morning').value || '08:30');
    await setSetting('pushEvening', q('#ntf-evening').value || '20:30');
    await setSetting('pushEveningOn', q('#ntf-evening-on').checked);
  };
  const enable = q('#ntf-enable');
  if (enable) {
    enable.onclick = async () => {
      enable.disabled = true;
      status.textContent = 'Подключаю…';
      try {
        await savePrefs();
        if (Notification.permission !== 'granted') {
          const r = await Notification.requestPermission();
          if (r !== 'granted') throw new Error(r === 'denied' ? 'Уведомления запрещены. Разрешите их: Настройки iPhone → Уведомления → Español.' : 'Разрешение не дано.');
        }
        await subscribeAndSave();
        status.textContent = 'Готово — время сохранено.';
        render(container);
      } catch (err) {
        status.textContent = err.message;
        enable.disabled = false;
      }
    };
  }
  q('#ntf-sample').onclick = async () => {
    try {
      if (!pushSupported()) throw new Error('Уведомления не поддерживаются в этом браузере.');
      if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') throw new Error('Разрешите уведомления, чтобы увидеть пример.');
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('¡Buenos días! ☀️ Пора заниматься', {
        body: 'Серия: 5 дней. 14 карточек на сегодня · 5 новых слов · занятие ~15 минут.\nФраза дня: «Poco a poco se va lejos.»',
        icon: './icons/icon-192.png', tag: 'espanol-sample', data: { url: './#session' },
      });
      status.textContent = 'Пример показан.';
    } catch (err) { status.textContent = err.message; }
  };
  const copy = q('#ntf-copy');
  if (copy) {
    copy.onclick = async () => {
      const text = q('#ntf-secret').value;
      try { await navigator.clipboard.writeText(text); status.textContent = 'Ключ скопирован — вставьте его в GitHub как PUSH_CONFIG.'; }
      catch (err) { q('#ntf-secret').closest('details').open = true; q('#ntf-secret').select(); status.textContent = 'Скопируйте ключ вручную из поля ниже.'; }
    };
  }
  q('#ntf-ics').onclick = () => downloadReminder(q('#ntf-morning').value || p.morning);
}

registerFeature({ id: 'notify', title: 'Напоминания', icon: '🔔', order: 93, render });

// Напоминания без сервера: ежедневное событие в календаре (.ics) + счётчик карточек на иконке приложения.
import { getAllWords, getSetting } from './db.js';
import { buildQueue, DEFAULT_LIMITS } from './queue.js';

const pad = (n) => String(n).padStart(2, '0');

function icsDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsStamp(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// Ежедневное событие на 10 минут в выбранное время (по местному времени устройства) с уведомлением.
export function buildReminderIcs({ time = '19:00', url = '', now = Date.now() } = {}) {
  const [h, m] = String(time).split(':').map((x) => parseInt(x, 10));
  const hh = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 19;
  const mm = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  const start = new Date(now);
  const day = icsDate(start);
  const endMin = hh * 60 + mm + 10;
  const endH = Math.min(23, Math.floor(endMin / 60));
  const endM = endMin >= 24 * 60 ? 59 : endMin % 60;
  const desc = `Повторить карточки, 5 слов дня и одна сценка.${url ? `\n${url}` : ''}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Espanol Benidorm//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:espanol-benidorm-daily-${day}@espanol-benidorm`,
    `DTSTAMP:${icsStamp(start)}`,
    `DTSTART:${day}T${pad(hh)}${pad(mm)}00`,
    `DTEND:${day}T${pad(endH)}${pad(endM)}00`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${esc('🇪🇸 Испанский: 10 минут')}`,
    `DESCRIPTION:${esc(desc)}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Время испанского! ¡Vamos!')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function downloadReminder(time) {
  const ics = buildReminderIcs({ time, url: location.href.split('#')[0] });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'espanol-napominanie.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function getLimits() {
  return {
    maxNew: Number(await getSetting('maxNew')) || DEFAULT_LIMITS.maxNew,
    maxReviews: Number(await getSetting('maxReviews')) || DEFAULT_LIMITS.maxReviews,
  };
}

// Число на иконке установленного приложения = карточек на сегодня (iOS 16.4+, Chrome).
export async function refreshBadge(count) {
  try {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    if ((await getSetting('badge')) === false) { await navigator.clearAppBadge(); return; }
    let n = count;
    if (n === undefined) n = buildQueue(await getAllWords(), Date.now(), await getLimits()).queue.length;
    if (n > 0) await navigator.setAppBadge(n);
    else await navigator.clearAppBadge();
  } catch (e) { /* значок — необязательная функция */ }
}

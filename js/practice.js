// Вкладка «Практика»: вся живая речь в одном меню — сценки, книга, аудио, логопед, задания.
import { registerFeature } from './app.js';
import { getActivity } from './activity.js';
import { getAssignments } from './profile.js';
import { escapeHtml } from './util.js';
import { icon } from './icons.js';

export const PRACTICE_ITEMS = [
  { id: 'roleplay', title: 'Сценки', es: 'Escenas', sub: 'Бар, Mercadona, хозяин квартиры — разговор в роли', kinds: ['roleplay'] },
  { id: 'reader', title: 'Книга', es: 'Lectura', sub: 'Фото страницы → перевод, смысл и новые слова', kinds: ['reading'] },
  { id: 'listening', title: 'Аудио', es: 'Escuchar', sub: 'Диалоги на слух и диктант', kinds: ['listening', 'dictation'] },
  { id: 'speech', title: 'Логопед', es: 'Pronunciación', sub: 'Скажите фразу — разберу произношение', kinds: ['speech'] },
  { id: 'assignments', title: 'Задания', es: 'Deberes', sub: 'Короткое письменное задание с проверкой', kinds: ['assignment'] },
];

async function render(container) {
  const e = escapeHtml;
  const [activity, assignments] = await Promise.all([getActivity(), getAssignments()]);
  const open = (assignments || []).filter((a) => a.status !== 'done').length;
  container.innerHTML = `
    <h1>Практика</h1>
    <p class="lead">Живая речь: выберите, чем заняться сегодня.</p>
    <div class="hub-grid">
      ${PRACTICE_ITEMS.map((it) => {
        const done = it.kinds.some((k) => (activity[k] || 0) > 0);
        const badge = it.id === 'assignments' && open ? `<span class="hub-badge">${open}</span>` : '';
        return `<a class="hub-tile${done ? ' done' : ''}" href="#${it.id}">
          <span class="hub-icon">${icon(done ? 'check' : it.id)}</span>${badge}
          <span class="hub-title">${e(it.title)}</span>
          <span class="hub-es">${e(it.es)}</span>
          <span class="hub-sub">${e(it.sub)}</span>
          ${done ? '<span class="sr-only">— сегодня уже было</span>' : ''}
        </a>`;
      }).join('')}
    </div>`;
}

registerFeature({ id: 'practice', title: 'Практика', icon: '🎭', order: 24, render });

// Набор линейных иконок (24×24, цвет — currentColor). Вместо эмодзи в навигации и на главном экране.
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  teacher: '<path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z"/><path d="M7 10.6V15c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.4"/><path d="M21 8.5V14"/>',
  chat: '<path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M8 10.5h8M8 13.5h5"/>',
  study: '<rect x="3.5" y="7" width="13" height="13" rx="2"/><path d="M7.5 7V5.5A1.5 1.5 0 0 1 9 4h10a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 19 17h-2.5"/><path d="M7 13.5h6"/>',
  daily: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m10 14.5 1.6 1.6 3-3.2"/>',
  roleplay: '<path d="M3.5 6.5h9.5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H8l-3 2.5V14.5H3.5A1.5 1.5 0 0 1 2 13V8a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M17 9.5h3.5A1.5 1.5 0 0 1 22 11v5a1.5 1.5 0 0 1-1.5 1.5H19V20l-3-2.5h-4.5a1.5 1.5 0 0 1-1.5-1.5"/>',
  dictionary: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6M9 10.5h4"/>',
  listening: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/>',
  speech: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  grammar: '<path d="m14.5 4.5 5 5L9 20H4v-5L14.5 4.5Z"/><path d="m12.5 6.5 5 5"/>',
  assignments: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3.5A1 1 0 0 1 10 2.5h4a1 1 0 0 1 1 1v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  progress: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  reader: '<path d="M12 6.5c-1.8-1.4-4.3-2-8-2v13c3.7 0 6.2.6 8 2 1.8-1.4 4.3-2 8-2v-13c-3.7 0-6.2.6-8 2Z"/><path d="M12 6.5v13"/><path d="M7 9h2.5M7 12h2.5M14.5 9H17M14.5 12H17"/>',
  more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.7-8.3.4 1.9 1.4 3 2.6 3.6C12 7 13.2 4.6 15 3c.3 3.3 3.5 6.2 3.5 11.8C18.5 18.4 15.9 21 12 21Z"/><path d="M12 21c-1.6 0-2.8-1.1-2.8-2.7 0-1.7 1.4-2.6 2.1-4 .9 1.1 3.5 2.1 3.5 4 0 1.6-1.2 2.7-2.8 2.7Z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
};

export function icon(name, cls = 'ic') {
  const body = P[name] || P.more;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const hasIcon = (name) => name in P;

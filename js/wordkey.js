// Ключ карточки для слияния и пометок удаления. У обычных слов — само слово,
// у учебных карточек (глагол, «исправь фразу») — с префиксом вида, чтобы не путать со словами.
export function wordKey(w) {
  const es = String((w && w.es) || '').trim().toLowerCase();
  return w && w.kind ? `${w.kind}:${es}` : es;
}

// Слово словаря (а не карточка тренажёра).
export const isVocab = (w) => !!w && !w.kind;

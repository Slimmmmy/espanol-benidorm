// Определение языка ввода по наличию кириллицы.
const CYRILLIC = /[Ѐ-ӿ]/;

export function detectLang(text) {
  if (text && CYRILLIC.test(text)) return 'ru';
  return 'es';
}

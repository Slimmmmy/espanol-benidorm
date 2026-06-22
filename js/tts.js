// Озвучка текста через Web Speech API (SpeechSynthesis).
export function speak(text, lang = 'es-ES') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const esVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('es'));
  if (esVoice) u.voice = esVoice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}

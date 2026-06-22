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

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

export function speakSequence(lines, lang = 'es-ES') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const esVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('es'));
  const speakers = [];
  const pitchFor = (speaker) => {
    if (!speaker) return 1.0;
    let i = speakers.indexOf(speaker);
    if (i === -1) { speakers.push(speaker); i = speakers.length - 1; }
    return i % 2 === 0 ? 1.05 : 0.8;
  };
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line.es);
    u.lang = lang;
    if (esVoice) u.voice = esVoice;
    u.pitch = pitchFor(line.speaker);
    speechSynthesis.speak(u);
  }
}

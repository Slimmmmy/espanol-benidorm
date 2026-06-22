// Однократное распознавание речи через Web Speech API (лучше всего в Chrome).
export function recognizeOnce(lang = 'es-ES') {
  return new Promise((resolve, reject) => {
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      reject(new Error('Распознавание речи недоступно в этом браузере. Открой приложение в Chrome.'));
      return;
    }
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let got = false;
    r.onresult = (e) => { got = true; resolve(e.results[0][0].transcript); };
    r.onerror = (e) => { got = true; reject(new Error('Ошибка распознавания: ' + (e.error || 'неизвестно'))); };
    r.onend = () => { if (!got) reject(new Error('Речь не распознана. Попробуй ещё раз, ближе к микрофону.')); };
    r.start();
  });
}

/**
 * voiceGuide.ts — Natural voice for PhysioCore AI guided assessments.
 * Selects best available voice, avoids robotic defaults.
 * Used by: GuidedROMAssessment, ROMAssessment, GaitAssessment.
 */

const PREFERRED_VOICES = [
  'Samantha',                   // iOS/macOS — best quality
  'Google UK English Female',   // Chrome desktop
  'Google US English',          // Chrome fallback
  'Microsoft Zira',             // Windows Edge
  'Karen',                      // macOS AU
  'Moira',                      // macOS IE
  'Victoria',                   // macOS
];

let _voice: SpeechSynthesisVoice | null = null;

function getBestVoice(): SpeechSynthesisVoice | null {
  if (_voice) return _voice;
  const voices = window.speechSynthesis.getVoices();
  for (const name of PREFERRED_VOICES) {
    const match = voices.find(v => v.name.includes(name));
    if (match) { _voice = match; return match; }
  }
  // Fallback: first English voice that isn't eSpeak (robotic)
  const english = voices.find(
    v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('espeak'),
  );
  return english ?? voices[0] ?? null;
}

export function speak(
  text: string,
  options: { rate?: number; pitch?: number; volume?: number } = {},
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utter      = new SpeechSynthesisUtterance(text);
  utter.rate       = options.rate   ?? 0.92;
  utter.pitch      = options.pitch  ?? 1.0;
  utter.volume     = options.volume ?? 1.0;

  // iOS: voices may not be loaded yet on first call
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      _voice = null;                    // reset cache — voices now available
      utter.voice = getBestVoice();
      window.speechSynthesis.speak(utter);
    }, { once: true });
  } else {
    utter.voice = getBestVoice();
    window.speechSynthesis.speak(utter);
  }
}

export function stopSpeech(): void {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

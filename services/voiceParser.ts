type VoiceCommand =
  | { type: 'FEED'; amountMl: number }
  | { type: 'SLEEP_TOGGLE'; state?: 'SLEEP' | 'WAKE' }
  | { type: 'TEMP'; value: number }
  | { type: 'POOP' }
  | null;

export function parseVoiceCommand(text: string): VoiceCommand {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ').toLowerCase();

  // FEED: look for numbers + ml
  const feedMatch = normalized.match(/(?:분유|수유|젖)[^\d]*(\d{1,4})\s*(?:ml|밀리리터|밀리)?/i);
  if (feedMatch) {
    const amount = parseInt(feedMatch[1], 10);
    if (!isNaN(amount) && amount > 0) return { type: 'FEED', amountMl: amount };
  }

  // TEMP: e.g. "체온 36.8"
  const tempMatch = normalized.match(/(?:체온|온도)[^\d]*(\d{2}(?:\.\d)?)/i);
  if (tempMatch) {
    const v = parseFloat(tempMatch[1]);
    if (!isNaN(v)) return { type: 'TEMP', value: v };
  }

  // POOP
  if (/(대변|배변|똥)/.test(normalized)) return { type: 'POOP' };

  // Sleep commands
  if (/(잠.*들|자러|수면 시작|잠들었)/.test(normalized)) return { type: 'SLEEP_TOGGLE', state: 'SLEEP' };
  if (/(깨어나|잠에서 깨어|일어났|깨웠)/.test(normalized)) return { type: 'SLEEP_TOGGLE', state: 'WAKE' };

  return null;
}

export type { VoiceCommand };

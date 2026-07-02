import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY. Set it in .env.local (dev) or the Vercel project env vars (prod).');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

import { API_PATHS, fetchJson } from '../lib/api';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export const askAssistant = async (familyCode: string, question: string, history: AssistantTurn[]) =>
  fetchJson(API_PATHS.assistant, {
    method: 'POST',
    body: JSON.stringify({ familyCode, question, history }),
  }) as Promise<{ success: boolean; answer: string; error?: string }>;

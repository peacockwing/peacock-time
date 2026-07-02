import { API_PATHS, fetchJson } from '../lib/api';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export const askAssistant = async (familyCode: string, question: string, actorEmail?: string | null) =>
  fetchJson(API_PATHS.assistant, {
    method: 'POST',
    body: JSON.stringify({ familyCode, question, actorEmail }),
  }) as Promise<{ success: boolean; answer: string; error?: string }>;

export const fetchAssistantHistory = async (familyCode: string) =>
  fetchJson(`${API_PATHS.assistantHistory}?familyCode=${encodeURIComponent(familyCode)}`) as Promise<{
    success: boolean;
    messages: AssistantTurn[];
    error?: string;
  }>;

export const clearAssistantHistory = async (familyCode: string) =>
  fetchJson(`${API_PATHS.assistantHistory}?familyCode=${encodeURIComponent(familyCode)}`, {
    method: 'DELETE',
  }) as Promise<{ success: boolean; error?: string }>;

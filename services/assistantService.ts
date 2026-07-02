import { API_PATHS, fetchJson } from '../lib/api';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export const askAssistant = async (familyCode: string, question: string, conversationId: string | null, actorEmail?: string | null) =>
  fetchJson(API_PATHS.assistant, {
    method: 'POST',
    body: JSON.stringify({ familyCode, question, conversationId, actorEmail }),
  }) as Promise<{ success: boolean; answer: string; conversationId: string; title?: string; error?: string }>;

export const fetchConversations = async (familyCode: string) =>
  fetchJson(`${API_PATHS.assistantConversations}?familyCode=${encodeURIComponent(familyCode)}`) as Promise<{
    success: boolean;
    conversations: AssistantConversationSummary[];
    error?: string;
  }>;

export const fetchConversationMessages = async (familyCode: string, conversationId: string) =>
  fetchJson(`${API_PATHS.assistantConversations}/${conversationId}?familyCode=${encodeURIComponent(familyCode)}`) as Promise<{
    success: boolean;
    title: string;
    messages: AssistantTurn[];
    error?: string;
  }>;

export const deleteConversation = async (familyCode: string, conversationId: string) =>
  fetchJson(`${API_PATHS.assistantConversations}/${conversationId}?familyCode=${encodeURIComponent(familyCode)}`, {
    method: 'DELETE',
  }) as Promise<{ success: boolean; error?: string }>;

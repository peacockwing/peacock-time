export const API_PATHS = {
  auth: '/api/auth',
  activities: '/api/activities',
  tabs: '/api/tabs',
  cryAnalysis: '/api/cry-analysis',
  customFields: '/api/custom-fields',
  categorySettings: '/api/settings/categories',
  recommendations: '/api/recommendations',
  assistant: '/api/assistant',
  assistantConversations: '/api/assistant/conversations',
};

export const fetchJson = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error || 'API 요청 실패');
  }

  return json;
};

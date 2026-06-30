export const API_PATHS = {
  auth: '/api/auth',
  babyLog: '/api/baby-log',
  tabs: '/api/tabs',
  babyLogAnalyzeCry: '/api/baby-log/analyze-cry',
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

import { API_PATHS } from '../lib/api';

export const fetchTabData = async (familyCode: string, targetTab: 'checklist' | 'inventory') => {
  const res = await fetch(`${API_PATHS.tabs}?familyCode=${encodeURIComponent(familyCode)}&targetTab=${encodeURIComponent(targetTab)}&t=${Date.now()}`, { cache: 'no-store' });
  return res.json();
};

export const updateTabItem = async (payload: { familyCode: string; targetTab: 'checklist' | 'inventory'; id: number; isCompleted?: number; status?: string }) => {
  const res = await fetch(API_PATHS.tabs, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

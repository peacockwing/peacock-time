import { API_PATHS } from '../lib/api';
import type { BabyLog } from '../types/baby';

export const fetchBabyLogs = async (familyCode: string) => {
  const res = await fetch(`${API_PATHS.babyLog}?familyCode=${encodeURIComponent(familyCode)}&t=${Date.now()}`, { cache: 'no-store' });
  return res.json() as Promise<{ success: boolean; logs: BabyLog[] }>;
};

export const createBabyLog = async (payload: {
  familyCode: string;
  categoryCode: string;
  categoryNameHan: string;
  eventValue: string;
  displayEmoji: string;
  actorEmail: string;
}) => {
  const res = await fetch(API_PATHS.babyLog, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const deleteBabyLog = async (id: number, familyCode: string) => {
  const res = await fetch(`${API_PATHS.babyLog}/${id}?familyCode=${encodeURIComponent(familyCode)}`, {
    method: 'DELETE',
  });
  return res.json();
};

export const analyzeCry = async (payload: { avg_frequency: number; max_decibel: number; familyCode?: string }) => {
  const res = await fetch(API_PATHS.babyLogAnalyzeCry, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

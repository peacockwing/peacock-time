import { API_PATHS, fetchJson } from '../lib/api';
import type { Activity, CategorySettingEntry, CustomFieldDefinition, Recommendation } from '../types/activity';

export const fetchActivities = async (familyCode: string, params?: { category?: string; from?: string; to?: string }) => {
  const query = new URLSearchParams({ familyCode, t: String(Date.now()) });
  if (params?.category) query.set('category', params.category);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const res = await fetch(`${API_PATHS.activities}?${query.toString()}`, { cache: 'no-store' });
  return res.json() as Promise<{ success: boolean; activities: Activity[]; error?: string }>;
};

export const createActivity = async (payload: {
  familyCode: string;
  category: string;
  actorEmail?: string;
  startTime: string;
  endTime?: string | null;
  memo?: string;
  hashtags?: string[];
  detail?: Record<string, any>;
}) => fetchJson(API_PATHS.activities, { method: 'POST', body: JSON.stringify(payload) }) as Promise<{ success: boolean; activity: Activity }>;

export const updateActivity = async (
  id: number,
  familyCode: string,
  payload: { endTime?: string | null; memo?: string; hashtags?: string[]; detail?: Record<string, any> }
) => fetchJson(`${API_PATHS.activities}/${id}`, { method: 'PATCH', body: JSON.stringify({ familyCode, ...payload }) }) as Promise<{ success: boolean; activity: Activity }>;

export const deleteActivity = async (id: number, familyCode: string) =>
  fetchJson(`${API_PATHS.activities}/${id}?familyCode=${encodeURIComponent(familyCode)}`, { method: 'DELETE' });

export const fetchCustomFields = async (familyCode: string) => {
  const res = await fetch(`${API_PATHS.customFields}?familyCode=${encodeURIComponent(familyCode)}`, { cache: 'no-store' });
  return res.json() as Promise<{ success: boolean; customFields: CustomFieldDefinition[] }>;
};

export const createCustomField = async (payload: { familyCode: string; name: string; unit?: string; valueType?: 'TEXT' | 'NUMBER' }) =>
  fetchJson(API_PATHS.customFields, { method: 'POST', body: JSON.stringify(payload) });

export const updateCustomField = async (
  id: number,
  familyCode: string,
  payload: { name?: string; unit?: string; isEnabled?: boolean; displayOrder?: number }
) => fetchJson(`${API_PATHS.customFields}/${id}`, { method: 'PATCH', body: JSON.stringify({ familyCode, ...payload }) });

export const deleteCustomField = async (id: number, familyCode: string) =>
  fetchJson(`${API_PATHS.customFields}/${id}?familyCode=${encodeURIComponent(familyCode)}`, { method: 'DELETE' });

export const fetchCategorySettings = async (familyCode: string) => {
  const res = await fetch(`${API_PATHS.categorySettings}?familyCode=${encodeURIComponent(familyCode)}`, { cache: 'no-store' });
  return res.json() as Promise<{ success: boolean; categories: CategorySettingEntry[] }>;
};

export const saveCategorySettings = async (familyCode: string, categories: { category: string; isEnabled: boolean; displayOrder: number }[]) =>
  fetchJson(API_PATHS.categorySettings, { method: 'PUT', body: JSON.stringify({ familyCode, categories }) });

export const analyzeCry = async (payload: { avg_frequency: number; max_decibel: number; familyCode?: string }) =>
  fetchJson(API_PATHS.cryAnalysis, { method: 'POST', body: JSON.stringify(payload) });

export const fetchRecommendations = async (familyCode: string) => {
  const res = await fetch(`${API_PATHS.recommendations}?familyCode=${encodeURIComponent(familyCode)}`, { cache: 'no-store' });
  return res.json() as Promise<{ success: boolean; recommendations: Recommendation[] }>;
};

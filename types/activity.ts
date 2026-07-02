import type { ActivityCategoryCode } from '../lib/activityCategories';

export interface Activity {
  id: number;
  family_code: string;
  category: ActivityCategoryCode | 'CUSTOM';
  actor_email: string | null;
  start_time: string;
  end_time: string | null;
  photo_url: string | null;
  memo: string | null;
  hashtags: string[];
  created_at: string;
  updated_at: string;
  detail: Record<string, any> | null;
}

export interface CustomFieldDefinition {
  id: number;
  family_code: string;
  name: string;
  unit: string | null;
  value_type: 'TEXT' | 'NUMBER';
  is_enabled: boolean;
  display_order: number;
  created_at: string;
}

export interface CategorySettingEntry {
  category: ActivityCategoryCode;
  label: string;
  emoji: string;
  isEnabled: boolean;
  displayOrder: number;
}

import { getCategoryDef } from './activityCategories';
import type { Activity, CustomFieldDefinition } from '../types/activity';

const SIDE_LABEL: Record<string, string> = {
  UNKNOWN: '모름',
  LEFT: '왼쪽',
  RIGHT: '오른쪽',
  BOTH: '양쪽',
  LEFT_TO_RIGHT: '왼쪽→오른쪽',
  RIGHT_TO_LEFT: '오른쪽→왼쪽',
};

const DIAPER_LABEL: Record<string, string> = { PEE: '소변', POOP: '대변', BOTH: '둘다' };
const SLEEP_LABEL: Record<string, string> = { NAP: '낮잠', NIGHT: '밤잠' };
const HOSPITAL_LABEL: Record<string, string> = { CHECKUP: '검진', ILLNESS: '질환' };

// One-line summary shown in the feed, e.g. "왼쪽 · 12분" or "120ml (목표 150ml)".
export const summarizeActivity = (activity: Activity, customFields: CustomFieldDefinition[]): string => {
  const d = activity.detail || {};

  switch (activity.category) {
    case 'BREASTFEEDING': {
      const parts = [SIDE_LABEL[d.side] || null, d.left_duration_sec ? `왼쪽 ${Math.round(d.left_duration_sec / 60)}분` : null, d.right_duration_sec ? `오른쪽 ${Math.round(d.right_duration_sec / 60)}분` : null];
      return parts.filter(Boolean).join(' · ') || '모유수유';
    }
    case 'FORMULA':
    case 'PUMPED_MILK_FEEDING': {
      if (typeof d.final_amount_ml === 'number') return `${d.final_amount_ml}ml${d.target_amount_ml ? ` (목표 ${d.target_amount_ml}ml)` : ''}`;
      return d.formula_type || (activity.category === 'FORMULA' ? '분유' : '유축수유');
    }
    case 'BABY_FOOD': {
      const ingredients = Array.isArray(d.ingredients) && d.ingredients.length ? d.ingredients.join(', ') : null;
      return [d.food_type, ingredients, d.amount_fed].filter(Boolean).join(' · ') || '이유식';
    }
    case 'DIAPER':
      return [DIAPER_LABEL[d.type], d.weight_g ? `${d.weight_g}g` : null].filter(Boolean).join(' · ') || '기저귀';
    case 'SLEEP':
      return SLEEP_LABEL[d.sleep_type] || '수면';
    case 'PUMPING':
      return typeof d.total_amount_ml === 'number' ? `총 ${d.total_amount_ml}ml (${SIDE_LABEL[d.side] || '모름'})` : SIDE_LABEL[d.side] || '유축';
    case 'BATH':
      return '목욕';
    case 'HOSPITAL':
      return [HOSPITAL_LABEL[d.visit_type], d.hospital_name].filter(Boolean).join(' · ') || '병원';
    case 'TEMPERATURE':
      return typeof d.temperature_celsius === 'number' ? `${d.temperature_celsius}℃` : '체온';
    case 'MEDICATION':
      return d.medication_name || '투약';
    case 'SNACK':
      return [d.snack_type, d.amount_fed, d.calories ? `${d.calories}kcal` : null].filter(Boolean).join(' · ') || '간식';
    case 'MILK':
      return [d.milk_type, d.amount_ml ? `${d.amount_ml}ml` : null].filter(Boolean).join(' · ') || '우유';
    case 'WATER':
      return d.amount_ml ? `${d.amount_ml}ml` : '물';
    case 'PLAY':
      return d.play_type || '놀이';
    case 'TUMMY_TIME':
      return '터미타임';
    case 'GROWTH':
      return [d.height_cm ? `${d.height_cm}cm` : null, d.weight_kg ? `${d.weight_kg}kg` : null].filter(Boolean).join(' · ') || '성장';
    case 'CRY_ANALYSIS':
      return d.summary || 'AI 울음 분석';
    case 'CUSTOM': {
      const def = customFields.find((c) => c.id === d.definition_id);
      const value = d.value_number ?? d.value_text;
      return def ? `${def.name}: ${value ?? ''}${def.unit || ''}` : String(value ?? '커스텀');
    }
    default:
      return getCategoryDef(activity.category)?.label || activity.category;
  }
};

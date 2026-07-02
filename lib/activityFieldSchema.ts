import { ACTIVITY_CATEGORY_MAP, type ActivityCategoryCode, type CategoryFieldDef } from './activityCategories';

// Turns one category's field definitions (the same source of truth the form
// and validation use) into a Claude structured-output JSON schema. Keeps the
// voice-command engine from needing 16 hand-authored per-category schemas -
// every field the form knows about is automatically extractable by voice.
const fieldToJsonSchema = (field: CategoryFieldDef) => {
  const description = field.label + (field.unit ? ` (단위: ${field.unit})` : '');
  if (field.type === 'number') {
    return { type: ['number', 'null'], description };
  }
  if (field.type === 'select') {
    return { type: ['string', 'null'], enum: [...(field.options || []).map((o) => o.value), null], description };
  }
  if (field.type === 'tags') {
    return { type: 'array', items: { type: 'string' }, description: `${description} - 각 항목을 개별 문자열로` };
  }
  return { type: ['string', 'null'], description };
};

// Excludes computed fields (final_amount_ml, total_amount_ml) - those are
// derived server-side from other inputs, never spoken directly.
export const buildVoiceFieldSchema = (category: ActivityCategoryCode) => {
  const def = ACTIVITY_CATEGORY_MAP[category];
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const field of def?.fields || []) {
    if (field.computed) continue;
    properties[field.key] = fieldToJsonSchema(field);
    required.push(field.key);
  }

  return { properties, required, fieldDefs: (def?.fields || []).filter((f) => !f.computed) };
};

export const describeCategoryFieldsForPrompt = (category: ActivityCategoryCode) => {
  const def = ACTIVITY_CATEGORY_MAP[category];
  if (!def || def.fields.length === 0) return '(추가 필드 없음)';
  return def.fields
    .filter((f) => !f.computed)
    .map((f) => {
      if (f.type === 'select') return `${f.key} (${f.label}, 선택지: ${(f.options || []).map((o) => `${o.value}=${o.label}`).join('/')})`;
      return `${f.key} (${f.label}${f.unit ? `, 단위 ${f.unit}` : ''})`;
    })
    .join(', ');
};

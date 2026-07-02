import { ACTIVITY_CATEGORY_MAP, type ActivityCategoryCode } from './activityCategories';

// Maps each category to the Prisma relation name used on ActivityLog and
// the detail model's own delegate name on the Prisma client. Categories
// without extra fields (BATH, TUMMY_TIME) have no entry - only the base
// ActivityLog row is written for them. FORMULA and PUMPED_MILK_FEEDING
// share the bottleFeeding relation since they're structurally identical.
export const DETAIL_RELATION: Partial<Record<ActivityCategoryCode | 'CUSTOM', { relation: string; delegate: string }>> = {
  BREASTFEEDING: { relation: 'breastfeeding', delegate: 'breastfeedingDetail' },
  FORMULA: { relation: 'bottleFeeding', delegate: 'bottleFeedingDetail' },
  PUMPED_MILK_FEEDING: { relation: 'bottleFeeding', delegate: 'bottleFeedingDetail' },
  BABY_FOOD: { relation: 'babyFood', delegate: 'babyFoodDetail' },
  DIAPER: { relation: 'diaper', delegate: 'diaperDetail' },
  SLEEP: { relation: 'sleep', delegate: 'sleepDetail' },
  PUMPING: { relation: 'pumping', delegate: 'pumpingDetail' },
  HOSPITAL: { relation: 'hospital', delegate: 'hospitalDetail' },
  TEMPERATURE: { relation: 'temperature', delegate: 'temperatureDetail' },
  MEDICATION: { relation: 'medication', delegate: 'medicationDetail' },
  SNACK: { relation: 'snack', delegate: 'snackDetail' },
  MILK: { relation: 'milk', delegate: 'milkDetail' },
  WATER: { relation: 'water', delegate: 'waterDetail' },
  PLAY: { relation: 'play', delegate: 'playDetail' },
  GROWTH: { relation: 'growth', delegate: 'growthDetail' },
  CRY_ANALYSIS: { relation: 'cryAnalysis', delegate: 'cryAnalysisDetail' },
  CUSTOM: { relation: 'custom', delegate: 'customDetail' },
};

export const ALL_DETAIL_RELATIONS = Object.values(DETAIL_RELATION).map((d) => d!.relation);

// Numbers come back as BigInt (id) - convert to plain JS numbers so the
// payload can go through NextResponse.json().
const toPlain = (value: unknown): any => {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
};

// Flattens an ActivityLog row (with all possible detail relations included)
// into { ...commonFields, category, detail: {...category-specific fields} }.
export const serializeActivity = (row: any) => {
  const plain = toPlain(row);
  let detail: Record<string, any> | null = null;

  for (const relation of ALL_DETAIL_RELATIONS) {
    if (plain[relation]) {
      const { activity_id, ...rest } = plain[relation];
      detail = rest;
    }
    delete plain[relation];
  }

  return { ...plain, detail };
};

// Filters the incoming detail payload down to the fields that category
// actually declares (ignores unknown keys, drops empty strings), and
// coerces number-typed fields so string form values don't hit Prisma as
// the wrong type.
export const validateFieldsForCategory = (category: string, detail: Record<string, any> | undefined) => {
  if (category === 'CUSTOM') return detail || {};
  const def = ACTIVITY_CATEGORY_MAP[category as ActivityCategoryCode];
  if (!def || !detail) return {};

  const fieldTypes = new Map(def.fields.map((f) => [f.key, f.type]));
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (!fieldTypes.has(key) || value === undefined || value === '' || value === null) continue;
    const type = fieldTypes.get(key);
    if (type === 'number') {
      out[key] = Number(value);
    } else if (type === 'tags') {
      // Accepts either a real array (photo analysis) or a space/comma
      // separated string (the form's text input) and normalizes to string[].
      const arr = Array.isArray(value) ? value : String(value).split(/[\s,]+/);
      const cleaned = arr.map((v) => String(v).trim()).filter(Boolean);
      if (cleaned.length > 0) out[key] = cleaned;
    } else {
      out[key] = value;
    }
  }
  return out;
};

// Returns the labels of required fields missing from the (already-filtered)
// detail payload, e.g. ['종류'] for a DIAPER entry with no type selected.
export const getMissingRequiredFields = (category: string, filteredDetail: Record<string, any>) => {
  const def = ACTIVITY_CATEGORY_MAP[category as ActivityCategoryCode];
  if (!def) return [];
  return def.fields.filter((f) => f.required && filteredDetail[f.key] === undefined).map((f) => f.label);
};

// Fills in the derived amount fields the user doesn't type directly:
// - bottle feeding (FORMULA / PUMPED_MILK_FEEDING): final_amount_ml is
//   target - leftover + extra when a target was set, otherwise the user's
//   direct final_amount_ml input is kept as-is.
// - pumping: total_amount_ml is simply left + right.
export const computeDerivedFields = (category: string, fields: Record<string, any>) => {
  if (category === 'FORMULA' || category === 'PUMPED_MILK_FEEDING') {
    if (typeof fields.target_amount_ml === 'number') {
      const leftover = fields.leftover_ml ?? 0;
      const extra = fields.extra_ml ?? 0;
      fields.final_amount_ml = fields.target_amount_ml - leftover + extra;
    }
  }
  if (category === 'PUMPING') {
    if (typeof fields.left_amount_ml === 'number' || typeof fields.right_amount_ml === 'number') {
      fields.total_amount_ml = (fields.left_amount_ml ?? 0) + (fields.right_amount_ml ?? 0);
    }
  }
  return fields;
};

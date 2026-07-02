// Single source of truth for the 16 fixed activity categories: their
// labels, default emoji, and the category-specific fields they carry
// (mirrors the *Detail models in prisma/schema.prisma). Drives both the
// dynamic record form and the settings screen. CUSTOM (17) is handled
// separately since its fields are user-defined at runtime.

export type ActivityCategoryCode =
  | 'BREASTFEEDING'
  | 'FORMULA'
  | 'BABY_FOOD'
  | 'DIAPER'
  | 'SLEEP'
  | 'PUMPING'
  | 'PUMPED_MILK_FEEDING'
  | 'BATH'
  | 'HOSPITAL'
  | 'TEMPERATURE'
  | 'MEDICATION'
  | 'SNACK'
  | 'MILK'
  | 'WATER'
  | 'PLAY'
  | 'TUMMY_TIME';

// 'tags' fields are stored as a plain space/comma-separated string while the
// form is open (same pattern as the hashtag input) and only split into a
// string[] at submit time - see ActivityForm.tsx.
export type FieldType = 'select' | 'number' | 'text' | 'textarea' | 'tags';

export interface FieldOption {
  value: string;
  label: string;
}

export interface CategoryFieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  unit?: string;
  // Derived from other fields (e.g. final_amount_ml = target - leftover + extra);
  // shown read-only in the form instead of a free input.
  computed?: boolean;
  placeholder?: string;
  required?: boolean;
}

export interface CategoryDef {
  code: ActivityCategoryCode;
  label: string;
  emoji: string;
  fields: CategoryFieldDef[];
}

const SIDE_OPTIONS: FieldOption[] = [
  { value: 'UNKNOWN', label: '모름' },
  { value: 'LEFT', label: '왼쪽' },
  { value: 'RIGHT', label: '오른쪽' },
  { value: 'BOTH', label: '양쪽' },
  { value: 'LEFT_TO_RIGHT', label: '왼쪽→오른쪽' },
  { value: 'RIGHT_TO_LEFT', label: '오른쪽→왼쪽' },
];

const BOTTLE_FEEDING_FIELDS: CategoryFieldDef[] = [
  { key: 'target_amount_ml', label: '목표량', type: 'number', unit: 'ml' },
  { key: 'leftover_ml', label: '남긴량', type: 'number', unit: 'ml' },
  { key: 'extra_ml', label: '더먹은량', type: 'number', unit: 'ml' },
  { key: 'final_amount_ml', label: '최종량', type: 'number', unit: 'ml', computed: true },
];

export const ACTIVITY_CATEGORIES: CategoryDef[] = [
  {
    code: 'BREASTFEEDING',
    label: '모유',
    emoji: '🤱',
    fields: [
      { key: 'side', label: '수유 위치', type: 'select', options: SIDE_OPTIONS },
      { key: 'left_duration_sec', label: '왼쪽 소요시간', type: 'number', unit: '초' },
      { key: 'right_duration_sec', label: '오른쪽 소요시간', type: 'number', unit: '초' },
      { key: 'left_alarm_minutes', label: '왼쪽 알람', type: 'number', unit: '분' },
      { key: 'right_alarm_minutes', label: '오른쪽 알람', type: 'number', unit: '분' },
    ],
  },
  {
    code: 'FORMULA',
    label: '분유',
    emoji: '🍼',
    fields: [
      { key: 'formula_type', label: '분유 종류', type: 'text' },
      ...BOTTLE_FEEDING_FIELDS,
    ],
  },
  {
    code: 'BABY_FOOD',
    label: '이유식',
    emoji: '🥣',
    fields: [
      { key: 'food_type', label: '이유식 종류', type: 'text' },
      { key: 'ingredients', label: '재료', type: 'tags', placeholder: '예: 당근 브로콜리 소고기' },
      { key: 'amount_fed', label: '먹인량', type: 'text', placeholder: '예: 많이/보통/조금, 100g' },
    ],
  },
  {
    code: 'DIAPER',
    label: '기저귀',
    emoji: '🧷',
    fields: [
      {
        key: 'type',
        label: '종류',
        type: 'select',
        required: true,
        options: [
          { value: 'PEE', label: '소변' },
          { value: 'POOP', label: '대변' },
          { value: 'BOTH', label: '둘다' },
        ],
      },
      { key: 'stool_state', label: '변 상태', type: 'text', placeholder: '색상/농도 등' },
      { key: 'weight_g', label: '무게', type: 'number', unit: 'g' },
    ],
  },
  {
    code: 'SLEEP',
    label: '수면',
    emoji: '😴',
    fields: [
      {
        key: 'sleep_type',
        label: '수면 종류',
        type: 'select',
        required: true,
        options: [
          { value: 'NAP', label: '낮잠' },
          { value: 'NIGHT', label: '밤잠' },
        ],
      },
    ],
  },
  {
    code: 'PUMPING',
    label: '유축',
    emoji: '🫙',
    fields: [
      { key: 'side', label: '유축 위치', type: 'select', options: SIDE_OPTIONS },
      { key: 'left_amount_ml', label: '왼쪽 유축량', type: 'number', unit: 'ml' },
      { key: 'right_amount_ml', label: '오른쪽 유축량', type: 'number', unit: 'ml' },
      { key: 'total_amount_ml', label: '총량', type: 'number', unit: 'ml', computed: true },
    ],
  },
  {
    code: 'PUMPED_MILK_FEEDING',
    label: '유축수유',
    emoji: '🍼',
    fields: BOTTLE_FEEDING_FIELDS,
  },
  {
    code: 'BATH',
    label: '목욕',
    emoji: '🛁',
    fields: [],
  },
  {
    code: 'HOSPITAL',
    label: '병원',
    emoji: '🏥',
    fields: [
      {
        key: 'visit_type',
        label: '방문 유형',
        type: 'select',
        required: true,
        options: [
          { value: 'CHECKUP', label: '검진' },
          { value: 'ILLNESS', label: '질환' },
        ],
      },
      { key: 'hospital_name', label: '병원 이름', type: 'text' },
      { key: 'doctor_name', label: '의사 이름', type: 'text' },
      { key: 'content', label: '검진/처방 내용', type: 'textarea' },
    ],
  },
  {
    code: 'TEMPERATURE',
    label: '체온',
    emoji: '🌡️',
    fields: [{ key: 'temperature_celsius', label: '체온', type: 'number', unit: '℃', required: true }],
  },
  {
    code: 'MEDICATION',
    label: '투약',
    emoji: '💊',
    fields: [{ key: 'medication_name', label: '약 종류', type: 'text' }],
  },
  {
    code: 'SNACK',
    label: '간식',
    emoji: '🍪',
    fields: [
      { key: 'snack_type', label: '간식 종류', type: 'text' },
      { key: 'amount_fed', label: '먹인량', type: 'text' },
      { key: 'calories', label: '칼로리', type: 'number', unit: 'kcal' },
    ],
  },
  {
    code: 'MILK',
    label: '우유',
    emoji: '🥛',
    fields: [
      { key: 'milk_type', label: '우유 종류', type: 'text' },
      { key: 'amount_ml', label: '우유량', type: 'number', unit: 'ml' },
    ],
  },
  {
    code: 'WATER',
    label: '물',
    emoji: '💧',
    fields: [{ key: 'amount_ml', label: '물양', type: 'number', unit: 'ml' }],
  },
  {
    code: 'PLAY',
    label: '놀이',
    emoji: '🧸',
    fields: [{ key: 'play_type', label: '놀이 종류', type: 'text' }],
  },
  {
    code: 'TUMMY_TIME',
    label: '터미타임',
    emoji: '🐸',
    fields: [],
  },
];

export const ACTIVITY_CATEGORY_MAP: Record<ActivityCategoryCode, CategoryDef> = ACTIVITY_CATEGORIES.reduce(
  (acc, def) => {
    acc[def.code] = def;
    return acc;
  },
  {} as Record<ActivityCategoryCode, CategoryDef>
);

export const getCategoryDef = (code: string): CategoryDef | undefined =>
  ACTIVITY_CATEGORY_MAP[code as ActivityCategoryCode];

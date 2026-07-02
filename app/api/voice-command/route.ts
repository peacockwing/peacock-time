import { NextResponse } from 'next/server';
import { getAnthropic } from '../../../lib/anthropic';
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_MAP, type ActivityCategoryCode } from '../../../lib/activityCategories';
import { buildVoiceFieldSchema, describeCategoryFieldsForPrompt } from '../../../lib/activityFieldSchema';
import { validateFieldsForCategory } from '../../../lib/activityDetail';

const MODEL = 'claude-opus-4-8';
const CATEGORY_CODES = ACTIVITY_CATEGORIES.map((c) => c.code);

async function classifyCategory(anthropic: ReturnType<typeof getAnthropic>, transcript: string) {
  const categoryList = ACTIVITY_CATEGORIES.map((c) => `${c.code}=${c.label}`).join(', ');

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 100,
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            category: { type: ['string', 'null'], enum: [...CATEGORY_CODES, null], description: 'Which category this voice command is logging, or null if it does not match any' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['category', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: `This is a Korean voice command spoken to a childcare-tracking app to log a baby activity. Categories: ${categoryList}.\n\nCommand: "${transcript}"\n\nWhich category is this logging? Return null if it clearly isn't logging any of these.`,
      },
    ],
  } as any);

  const textBlock = res.content.find((b: any) => b.type === 'text');
  if (!textBlock || !('text' in textBlock)) return { category: null, confidence: 'low' as const };
  return JSON.parse(textBlock.text) as { category: ActivityCategoryCode | null; confidence: 'high' | 'medium' | 'low' };
}

async function extractFields(anthropic: ReturnType<typeof getAnthropic>, transcript: string, category: ActivityCategoryCode) {
  const { properties, required } = buildVoiceFieldSchema(category);
  const fieldDesc = describeCategoryFieldsForPrompt(category);
  const categoryLabel = ACTIVITY_CATEGORY_MAP[category]?.label || category;

  const schema = {
    type: 'object',
    properties: {
      ...properties,
      duration_minutes: {
        type: ['integer', 'null'],
        description:
          'Total duration of the activity in minutes, ONLY if mentioned and it does NOT already map to one of the specific fields above (e.g. use this for a plain "30분" tummy-time/bath/nap log when there is no dedicated duration field for it). Otherwise null.',
      },
    },
    required: [...required, 'duration_minutes'],
    additionalProperties: false,
  };

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema },
    },
    messages: [
      {
        role: 'user',
        content: `This Korean voice command logs a "${categoryLabel}" (${category}) baby activity: "${transcript}"\n\nAvailable fields: ${fieldDesc}\n\nExtract the values mentioned in the command for each field. Leave anything not mentioned as null. Convert units as needed to match each field's stated unit (e.g. "1시간" for a seconds field means 3600).`,
      },
    ],
  } as any);

  const textBlock = res.content.find((b: any) => b.type === 'text');
  if (!textBlock || !('text' in textBlock)) return { duration_minutes: null };
  return JSON.parse(textBlock.text) as Record<string, any>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ success: false, error: '음성 명령이 비어있습니다.' }, { status: 400 });
    }

    const anthropic = getAnthropic();

    const { category, confidence } = await classifyCategory(anthropic, transcript);
    if (!category || !ACTIVITY_CATEGORY_MAP[category]) {
      return NextResponse.json({ success: false, error: '어떤 항목을 기록할지 이해하지 못했어요. 다시 말씀해주세요.' }, { status: 422 });
    }

    const extracted = await extractFields(anthropic, transcript, category);
    const { duration_minutes, ...rawFields } = extracted;
    const detail = validateFieldsForCategory(category, rawFields);

    const now = Date.now();
    let startTime: string;
    let endTime: string | null;
    if (typeof duration_minutes === 'number' && duration_minutes > 0) {
      endTime = new Date(now).toISOString();
      startTime = new Date(now - duration_minutes * 60000).toISOString();
    } else {
      startTime = new Date(now).toISOString();
      endTime = startTime;
    }

    return NextResponse.json({
      success: true,
      category,
      confidence,
      detail,
      startTime,
      endTime,
      durationMinutes: typeof duration_minutes === 'number' ? duration_minutes : null,
    });
  } catch (error: any) {
    console.error('❌ POST /api/voice-command Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

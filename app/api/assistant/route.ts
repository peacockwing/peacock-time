import { NextResponse } from 'next/server';
import { getAnthropic } from '../../../lib/anthropic';
import { getPrisma } from '../../../lib/prisma';
import { ACTIVITY_CATEGORIES } from '../../../lib/activityCategories';
import { ALL_DETAIL_RELATIONS, serializeActivity } from '../../../lib/activityDetail';

const MODEL = 'claude-opus-4-8';
const MAX_TOOL_ITERATIONS = 5;
const includeAllDetails = Object.fromEntries(ALL_DETAIL_RELATIONS.map((r) => [r, true]));

const CATEGORY_CODES = [...ACTIVITY_CATEGORIES.map((c) => c.code), 'CUSTOM'];

const QUERY_ACTIVITIES_TOOL = {
  name: 'query_activities',
  description:
    'Look up this family\'s logged childcare activities. Always call this before answering any question about what happened, when, what was fed, amounts, ingredients, or patterns - never answer from memory or assumption. Call it again with a wider date range or different category if the first result seems insufficient.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: [...CATEGORY_CODES, 'ALL'],
        description: 'Which category to filter by, or ALL to search every category',
      },
      from: { type: 'string', description: 'ISO 8601 datetime - start of the range to search (inclusive)' },
      to: { type: 'string', description: 'ISO 8601 datetime - end of the range to search (inclusive)' },
      limit: { type: 'integer', description: 'Max number of results, default 50, hard cap 200' },
    },
    required: ['from', 'to'],
  },
};

async function executeQueryActivities(prisma: ReturnType<typeof getPrisma>, familyCode: string, input: any) {
  const { category, from, to, limit } = input || {};
  const take = Math.min(Number(limit) || 50, 200);

  const where: any = { family_code: familyCode };
  if (category && category !== 'ALL') where.category = category;
  if (from || to) {
    where.start_time = {};
    if (from) where.start_time.gte = new Date(from);
    if (to) where.start_time.lte = new Date(to);
  }

  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: { start_time: 'desc' },
    take,
    include: includeAllDetails,
  });

  return { count: rows.length, activities: rows.map(serializeActivity) };
}

const buildSystemPrompt = () => {
  const nowKst = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
  const categoryList = ACTIVITY_CATEGORIES.map((c) => `${c.code}(${c.label})`).join(', ');

  return `You are the in-app assistant for "피콕타임", a Korean childcare tracking app. Parents ask you questions about their baby's logged activities (feeding, diaper, sleep, etc.) and you answer using the app's actual data.

Current date/time (KST): ${nowKst}. Interpret relative references like "어제", "지난주", "점심" against this.

Categories: ${categoryList}, CUSTOM (user-defined items).

Rules:
- Always call query_activities to fetch real data before answering anything about what happened, when, ingredients, amounts, or patterns. Never fabricate or guess data that should come from a lookup.
- If a question needs a wide time range (e.g. "이 재료를 언제부터 먹였어?"), query broadly rather than assuming.
- For allergy-related questions: BABY_FOOD entries have a structured detail.ingredients list (each individual ingredient, e.g. ["당근","브로콜리","소고기"]) - use that instead of parsing detail.food_type. You are not a medical professional. You may point out ingredients that were logged shortly before a reaction (e.g. a diaper/skin issue noted via hashtags or memo) as things worth watching, but always say this is not a diagnosis and recommend consulting a pediatrician for confirmation.
- For meal-planning requests (이유식 식단 등), use the logged history to avoid repeating recent meals or suspected allergens, and use general food-safety knowledge for appropriate ingredients by age - but do not claim medical authority.
- Answer in Korean, concisely, in a warm but direct tone. Use the data you found to be specific (dates, times, amounts) rather than vague.`;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, question, history } = body;

    if (!familyCode || !question || typeof question !== 'string') {
      return NextResponse.json({ success: false, error: 'familyCode와 question이 필요합니다.' }, { status: 400 });
    }

    const anthropic = getAnthropic();
    const prisma = getPrisma();

    const priorTurns = Array.isArray(history)
      ? history
          .filter((m: any) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .slice(-10)
          .map((m: any) => ({ role: m.role, content: m.text }))
      : [];

    let messages: any[] = [...priorTurns, { role: 'user', content: question }];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(),
        tools: [QUERY_ACTIVITIES_TOOL],
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return NextResponse.json({ success: false, error: '답변할 수 없는 질문입니다.' }, { status: 422 });
      }

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b: any) => b.type === 'text');
        const answer = textBlock && 'text' in textBlock ? textBlock.text : '';
        return NextResponse.json({ success: true, answer });
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'query_activities') {
          try {
            const result = await executeQueryActivities(prisma, familyCode, block.input);
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
          } catch (e: any) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `조회 실패: ${e.message}`, is_error: true });
          }
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return NextResponse.json({ success: false, error: '응답을 생성하지 못했습니다. 다시 시도해주세요.' }, { status: 500 });
  } catch (error: any) {
    console.error('❌ POST /api/assistant Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { ACTIVITY_CATEGORY_MAP } from '../../../lib/activityCategories';
import {
  ALL_DETAIL_RELATIONS,
  DETAIL_RELATION,
  computeDerivedFields,
  getMissingRequiredFields,
  serializeActivity,
  validateFieldsForCategory,
} from '../../../lib/activityDetail';

const includeAllDetails = Object.fromEntries(ALL_DETAIL_RELATIONS.map((r) => [r, true]));

const isKnownCategory = (category: string) => category === 'CUSTOM' || Boolean(ACTIVITY_CATEGORY_MAP[category as keyof typeof ACTIVITY_CATEGORY_MAP]);

// Builds the { definition_id, value_text, value_number } payload for a
// CUSTOM entry, validating the definition belongs to this family and
// coercing the value to match its declared value_type.
const buildCustomDetail = async (prisma: ReturnType<typeof getPrisma>, familyCode: string, detail: any) => {
  const definitionId = Number(detail?.definitionId);
  if (!definitionId) throw new Error('커스텀 항목(definitionId)이 필요합니다.');

  const definition = await prisma.customFieldDefinition.findUnique({ where: { id: definitionId } });
  if (!definition || definition.family_code !== familyCode) {
    throw new Error('유효하지 않은 커스텀 항목입니다.');
  }

  if (definition.value_type === 'NUMBER') {
    const value = Number(detail?.valueNumber);
    if (Number.isNaN(value)) throw new Error('숫자 값이 필요합니다.');
    return { definition_id: definitionId, value_number: value };
  }
  return { definition_id: definitionId, value_text: String(detail?.valueText ?? '') };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    const category = searchParams.get('category');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 300);

    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const where: any = { family_code: familyCode };
    if (category) where.category = category;
    if (from || to) {
      where.start_time = {};
      if (from) where.start_time.gte = new Date(from);
      if (to) where.start_time.lte = new Date(to);
    }

    const rows = await prisma.activityLog.findMany({
      where,
      orderBy: { start_time: 'desc' },
      take: limit,
      include: includeAllDetails,
    });

    return NextResponse.json({ success: true, activities: rows.map(serializeActivity) });
  } catch (error: any) {
    console.error('❌ GET /api/activities Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, category, actorEmail, startTime, endTime, memo, hashtags, detail } = body;

    if (!familyCode || !category || !startTime) {
      return NextResponse.json({ success: false, error: 'familyCode, category, startTime는 필수입니다.' }, { status: 400 });
    }
    if (!isKnownCategory(category)) {
      return NextResponse.json({ success: false, error: `알 수 없는 category입니다: ${category}` }, { status: 400 });
    }

    const prisma = getPrisma();
    const data: any = {
      family_code: familyCode,
      category,
      actor_email: actorEmail || null,
      start_time: new Date(startTime),
      end_time: endTime ? new Date(endTime) : null,
      memo: memo || null,
      hashtags: Array.isArray(hashtags) ? hashtags.filter((h: unknown) => typeof h === 'string' && h.trim()) : [],
    };

    const relationInfo = DETAIL_RELATION[category as keyof typeof DETAIL_RELATION];
    if (relationInfo) {
      if (category === 'CUSTOM') {
        data[relationInfo.relation] = { create: await buildCustomDetail(prisma, familyCode, detail) };
      } else {
        const filtered = validateFieldsForCategory(category, detail);
        const missing = getMissingRequiredFields(category, filtered);
        if (missing.length > 0) {
          return NextResponse.json({ success: false, error: `필수 항목이 누락되었습니다: ${missing.join(', ')}` }, { status: 400 });
        }
        const withComputed = computeDerivedFields(category, filtered);
        if (Object.keys(withComputed).length > 0) {
          data[relationInfo.relation] = { create: withComputed };
        }
      }
    }

    const created = await prisma.activityLog.create({ data, include: includeAllDetails });
    return NextResponse.json({ success: true, activity: serializeActivity(created) }, { status: 201 });
  } catch (error: any) {
    console.error('❌ POST /api/activities Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

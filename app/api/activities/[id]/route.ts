import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';
import {
  ALL_DETAIL_RELATIONS,
  DETAIL_RELATION,
  computeDerivedFields,
  serializeActivity,
  validateFieldsForCategory,
} from '../../../../lib/activityDetail';

const includeAllDetails = Object.fromEntries(ALL_DETAIL_RELATIONS.map((r) => [r, true]));

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
    return { definition_id: definitionId, value_number: value, value_text: null };
  }
  return { definition_id: definitionId, value_text: String(detail?.valueText ?? ''), value_number: null };
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const activityId = Number(id);
    if (!activityId || Number.isNaN(activityId)) {
      return NextResponse.json({ success: false, error: '유효한 id가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { familyCode, endTime, memo, hashtags, detail } = body;
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode는 필수입니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const existing = await prisma.activityLog.findUnique({ where: { id: activityId } });
    if (!existing || existing.family_code !== familyCode) {
      return NextResponse.json({ success: false, error: '수정할 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    const data: any = {};
    if (endTime !== undefined) data.end_time = endTime ? new Date(endTime) : null;
    if (memo !== undefined) data.memo = memo || null;
    if (Array.isArray(hashtags)) data.hashtags = hashtags.filter((h: unknown) => typeof h === 'string' && h.trim());

    const relationInfo = DETAIL_RELATION[existing.category as keyof typeof DETAIL_RELATION];
    if (relationInfo && detail) {
      let detailFields: Record<string, any>;
      if (existing.category === 'CUSTOM') {
        detailFields = await buildCustomDetail(prisma, familyCode, detail);
      } else {
        detailFields = computeDerivedFields(existing.category, validateFieldsForCategory(existing.category, detail));
      }
      if (Object.keys(detailFields).length > 0) {
        data[relationInfo.relation] = { upsert: { create: detailFields, update: detailFields } };
      }
    }

    const updated = await prisma.activityLog.update({ where: { id: activityId }, data, include: includeAllDetails });
    return NextResponse.json({ success: true, activity: serializeActivity(updated) });
  } catch (error: any) {
    console.error('❌ PATCH /api/activities/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const activityId = Number(id);
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');

    if (!activityId || Number.isNaN(activityId)) {
      return NextResponse.json({ success: false, error: '유효한 id가 필요합니다.' }, { status: 400 });
    }
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode는 필수입니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const deleted = await prisma.activityLog.deleteMany({ where: { id: activityId, family_code: familyCode } });
    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: '삭제할 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: activityId });
  } catch (error: any) {
    console.error('❌ DELETE /api/activities/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

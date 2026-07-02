import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const definitionId = Number(id);
    const body = await request.json();
    const { familyCode, name, unit, isEnabled, displayOrder } = body;

    if (!definitionId || !familyCode) {
      return NextResponse.json({ success: false, error: 'id와 familyCode는 필수입니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const data: any = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (unit !== undefined) data.unit = unit || null;
    if (typeof isEnabled === 'boolean') data.is_enabled = isEnabled;
    if (typeof displayOrder === 'number') data.display_order = displayOrder;

    const updated = await prisma.customFieldDefinition.updateMany({
      where: { id: definitionId, family_code: familyCode },
      data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ PATCH /api/custom-fields/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const definitionId = Number(id);
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');

    if (!definitionId || !familyCode) {
      return NextResponse.json({ success: false, error: 'id와 familyCode는 필수입니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const deleted = await prisma.customFieldDefinition.deleteMany({ where: { id: definitionId, family_code: familyCode } });
    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: '삭제할 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: definitionId });
  } catch (error: any) {
    console.error('❌ DELETE /api/custom-fields/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

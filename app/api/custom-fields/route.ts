import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const definitions = await prisma.customFieldDefinition.findMany({
      where: { family_code: familyCode },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      customFields: definitions.map((d) => ({ ...d, id: Number(d.id) })),
    });
  } catch (error: any) {
    console.error('❌ GET /api/custom-fields Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, name, unit, valueType } = body;

    if (!familyCode || !name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'familyCode와 name은 필수입니다.' }, { status: 400 });
    }
    if (valueType && !['TEXT', 'NUMBER'].includes(valueType)) {
      return NextResponse.json({ success: false, error: 'valueType은 TEXT 또는 NUMBER여야 합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const count = await prisma.customFieldDefinition.count({ where: { family_code: familyCode } });
    const created = await prisma.customFieldDefinition.create({
      data: {
        family_code: familyCode,
        name: name.trim(),
        unit: unit || null,
        value_type: valueType || 'TEXT',
        display_order: count,
      },
    });

    return NextResponse.json({ success: true, customField: { ...created, id: Number(created.id) } }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: '이미 같은 이름의 커스텀 항목이 있습니다.' }, { status: 409 });
    }
    console.error('❌ POST /api/custom-fields Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

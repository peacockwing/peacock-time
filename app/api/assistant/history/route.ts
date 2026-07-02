import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const rows = await prisma.assistantMessage.findMany({
      where: { family_code: familyCode },
      orderBy: { created_at: 'asc' },
      take: 100,
    });

    const messages = rows.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      text: m.content,
      createdAt: m.created_at.toISOString(),
    }));

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('❌ GET /api/assistant/history Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    await prisma.assistantMessage.deleteMany({ where: { family_code: familyCode } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ DELETE /api/assistant/history Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

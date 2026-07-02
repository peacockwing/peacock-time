import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';

// Lists this family's conversations, most recently active first - used to
// populate the sidebar list (Gemini/ChatGPT-style).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const rows = await prisma.assistantConversation.findMany({
      where: { family_code: familyCode },
      orderBy: { updated_at: 'desc' },
      take: 100,
      select: { id: true, title: true, updated_at: true },
    });

    const conversations = rows.map((c) => ({
      id: c.id.toString(),
      title: c.title || '새 대화',
      updatedAt: c.updated_at.toISOString(),
    }));

    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    console.error('❌ GET /api/assistant/conversations Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

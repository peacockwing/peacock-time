import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../../lib/prisma';

// Fetches one conversation's full message list - used when the user selects
// a conversation from the sidebar to continue it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const conversation = await prisma.assistantConversation.findFirst({
      where: { id: BigInt(id), family_code: familyCode },
    });
    if (!conversation) {
      return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rows = await prisma.assistantMessage.findMany({
      where: { conversation_id: conversation.id },
      orderBy: { created_at: 'asc' },
    });

    const messages = rows.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      text: m.content,
      createdAt: m.created_at.toISOString(),
    }));

    return NextResponse.json({ success: true, title: conversation.title || '새 대화', messages });
  } catch (error: any) {
    console.error('❌ GET /api/assistant/conversations/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const result = await prisma.assistantConversation.deleteMany({
      where: { id: BigInt(id), family_code: familyCode },
    });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ DELETE /api/assistant/conversations/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

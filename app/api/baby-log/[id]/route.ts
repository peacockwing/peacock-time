import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  try {
    const { id } = await params;
    const numericId = Number(id);
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');

    if (!numericId || Number.isNaN(numericId)) {
      return NextResponse.json({ success: false, error: '유효한 id가 필요합니다.' }, { status: 400 });
    }

    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode는 필수입니다.' }, { status: 400 });
    }

    const deleted = await prisma.babyLog.deleteMany({
      where: {
        id: numericId,
        family_code: familyCode,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: '삭제할 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Supabase Realtime subscriptions will notify clients of deletes.
    // Prisma's deleteMany returns a count, not the deleted rows. Return
    // the numeric id and the count to keep callers informed.
    return NextResponse.json({ success: true, deletedId: numericId, deletedCount: deleted.count });
  } catch (error: any) {
    console.error('❌ DELETE /api/baby-log/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  try {
    const { id } = await params;
    const numericId = Number(id);
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    const body = await request.json();
    const updatePayload: Record<string, any> = {};

    if (!numericId || Number.isNaN(numericId)) {
      return NextResponse.json({ success: false, error: '유효한 id가 필요합니다.' }, { status: 400 });
    }
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode는 필수입니다.' }, { status: 400 });
    }

    if (typeof body.eventValue === 'string' && body.eventValue.trim() !== '') {
      updatePayload.event_value = body.eventValue.trim();
    }
    if (typeof body.eventTime === 'string' && body.eventTime.trim() !== '') {
      updatePayload.event_time = body.eventTime.trim();
    }
    if (typeof body.displayEmoji === 'string') {
      updatePayload.display_emoji = body.displayEmoji;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: false, error: '수정할 필드가 없습니다.' }, { status: 400 });
    }

    const updated = await prisma.babyLog.updateMany({
      where: {
        id: numericId,
        family_code: familyCode,
      },
      data: updatePayload,
    });

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: '수정할 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    const log = await prisma.babyLog.findUnique({
      where: { id: numericId },
    });

    return NextResponse.json({ success: true, log: log ? { ...log, id: Number(log.id) } : log });
  } catch (error: any) {
    console.error('❌ PATCH /api/baby-log/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

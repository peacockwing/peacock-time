// app/api/baby-log/route.ts
import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

// 1. 실시간 로그 조회 (GET)
export async function GET(request: Request) {
  const prisma = getPrisma();
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');

    if (!familyCode) {
      return NextResponse.json({ error: '가족 코드가 누락되었습니다.' }, { status: 400 });
    }

    const logs = await prisma.babyLog.findMany({
      where: { family_code: familyCode },
      orderBy: [
        { event_date: 'desc' },
        { event_time: 'desc' },
      ],
      take: 50,
    });

    return NextResponse.json({ success: true, logs: logs.map((log) => ({ ...log, id: Number(log.id) })) });
  } catch (error: any) {
    console.error('❌ GET /api/baby-log Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. 실시간 로그 삽입 (POST) -> 3초 병목 해결 구간
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, categoryCode, categoryNameHan, eventValue, displayEmoji, actorEmail } = body;

    // 인자 검증 로깅
    if (!familyCode || !categoryCode || !eventValue) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // 한국 시간(KST) YYYYMMDD, HH:MM 계산
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    
    const event_date = kstDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const event_time = kstDate.toISOString().slice(11, 16); // HH:MM

    const prisma = getPrisma();

    // Supabase DB Insert 통신
    const log = await prisma.babyLog.create({
      data: {
        family_code: familyCode,
        category_code: categoryCode,
        category_name_han: categoryNameHan,
        event_value: eventValue,
        event_date,
        event_time,
        display_emoji: displayEmoji,
        actor_email: actorEmail || 'parent@example.com',
      },
    });

    return NextResponse.json({ success: true, log: { ...log, id: Number(log.id) } }, { status: 200 });

  } catch (error: any) {
    console.error('❌ POST /api/baby-log 500 Error:', error.message);
    return NextResponse.json({ error: '서버 내부 에러: ' + error.message }, { status: 500 });
  }
}
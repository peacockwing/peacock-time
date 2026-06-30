// app/api/baby-log/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { broadcastSocketAction } from '../../../lib/socketBroadcast';

// 1. 실시간 로그 조회 (GET)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');

    if (!familyCode) {
      return NextResponse.json({ error: '가족 코드가 누락되었습니다.' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('baby_log')
      .select('*')
      .eq('family_code', familyCode)
      .order('event_date', { ascending: false })
      .order('event_time', { ascending: false })
      .limit(50); // 성능 최적화를 위한 리밋 추가

    if (error) throw error;

    return NextResponse.json({ success: true, logs: data || [] });
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

    // Supabase DB Insert 통신
    const { data, error } = await getSupabaseAdmin()
      .from('baby_log')
      .insert([
        {
          family_code: familyCode,
          category_code: categoryCode,
          category_name_han: categoryNameHan,
          event_value: eventValue,
          event_date,
          event_time,
          display_emoji: displayEmoji,
          actor_email: actorEmail || 'parent@example.com'
        }
      ])
      .select();

    if (error) {
      console.error('💥 Supabase Insert Error:', error);
      throw error;
    }

    // Realtime updates will be handled by Supabase Realtime subscriptions.
    // No Socket.IO broadcast here to keep deployment serverless-friendly.

    return NextResponse.json({ success: true, log: data?.[0] || null }, { status: 200 });

  } catch (error: any) {
    console.error('❌ POST /api/baby-log 500 Error:', error.message);
    return NextResponse.json({ error: '서버 내부 에러: ' + error.message }, { status: 500 });
  }
}
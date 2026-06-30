import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { broadcastSocketAction } from '../../../lib/socketBroadcast';

const CHECKLIST_TABLE = 'checklist';
const INVENTORY_TABLE = 'inventory';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    const targetTab = searchParams.get('targetTab');

    if (!familyCode || !targetTab) {
      return NextResponse.json({ success: false, error: 'familyCode 또는 targetTab이 누락되었습니다.' }, { status: 400 });
    }

    if (!['checklist', 'inventory'].includes(targetTab)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 targetTab 값입니다.' }, { status: 400 });
    }

    const table = targetTab === 'checklist' ? CHECKLIST_TABLE : INVENTORY_TABLE;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('family_code', familyCode)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message || '데이터 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, targetTab, id, isCompleted, status } = body;

    if (!familyCode || !targetTab || !id) {
      return NextResponse.json({ success: false, error: 'familyCode, targetTab 및 id는 필수입니다.' }, { status: 400 });
    }

    if (!['checklist', 'inventory'].includes(targetTab)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 targetTab 값입니다.' }, { status: 400 });
    }

    const table = targetTab === 'checklist' ? CHECKLIST_TABLE : INVENTORY_TABLE;
    const updateData: Record<string, unknown> = {};

    if (typeof isCompleted === 'number') updateData.is_completed = isCompleted;
    if (typeof status === 'string') updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '업데이트할 필드가 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message || '업데이트 실패' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: '업데이트할 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    try {
      await broadcastSocketAction('tabs_update', data[0].family_code, { targetTab, item: data[0] });
    } catch (err) {
      console.error('Socket broadcast (tabs) failed:', err);
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

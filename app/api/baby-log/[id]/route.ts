import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { broadcastSocketAction } from '../../../../lib/socketBroadcast';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { data, error } = await supabaseAdmin
      .from('baby_log')
      .delete()
      .eq('id', numericId)
      .eq('family_code', familyCode)
      .select();

    if (error) {
      console.error('💥 Supabase Delete Error:', error);
      return NextResponse.json({ success: false, error: error.message || '삭제 실패' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: '삭제할 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    try {
      await broadcastSocketAction('delete_log', data[0].family_code, { id: data[0].id });
    } catch (err) {
      console.error('Socket broadcast (delete) failed:', err);
    }

    return NextResponse.json({ success: true, deleted: data[0] });
  } catch (error: any) {
    console.error('❌ DELETE /api/baby-log/[id] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

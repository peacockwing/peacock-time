import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

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

    const prisma = getPrisma();

    let data: any[] = [];
    if (targetTab === 'checklist') {
      data = await prisma.checklist.findMany({
        where: { family_code: familyCode },
        orderBy: { id: 'asc' },
      });
    } else {
      data = await prisma.inventory.findMany({
        where: { family_code: familyCode },
        orderBy: { id: 'asc' },
      });
    }

    return NextResponse.json({ success: true, data: data.map((item) => ({ ...item, id: Number(item.id) })) });
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

    const prisma = getPrisma();

    let updated: any;
    if (table === CHECKLIST_TABLE) {
      updated = await prisma.checklist.updateMany({
        where: { id },
        data: updateData,
      });
    } else {
      updated = await prisma.inventory.updateMany({
        where: { id },
        data: updateData,
      });
    }

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: '업데이트할 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    let data: any = null;
    if (table === CHECKLIST_TABLE) {
      data = await prisma.checklist.findUnique({ where: { id } });
    } else {
      data = await prisma.inventory.findUnique({ where: { id } });
    }
    return NextResponse.json({ success: true, data: data ? { ...data, id: Number(data.id) } : data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

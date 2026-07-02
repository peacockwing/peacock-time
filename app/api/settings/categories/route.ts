import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';
import { ACTIVITY_CATEGORIES } from '../../../../lib/activityCategories';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const settings = await prisma.categorySetting.findMany({ where: { family_code: familyCode } });
    const settingByCategory = new Map(settings.map((s) => [s.category, s]));

    const merged = ACTIVITY_CATEGORIES.map((def, index) => {
      const existing = settingByCategory.get(def.code);
      return {
        category: def.code,
        label: def.label,
        emoji: def.emoji,
        isEnabled: existing ? existing.is_enabled : true,
        displayOrder: existing ? existing.display_order : index,
      };
    }).sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({ success: true, categories: merged });
  } catch (error: any) {
    console.error('❌ GET /api/settings/categories Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, categories } = body;

    if (!familyCode || !Array.isArray(categories)) {
      return NextResponse.json({ success: false, error: 'familyCode와 categories 배열이 필요합니다.' }, { status: 400 });
    }

    const validCodes = new Set(ACTIVITY_CATEGORIES.map((c) => c.code));
    const prisma = getPrisma();

    await prisma.$transaction(
      categories
        .filter((c: any) => validCodes.has(c.category))
        .map((c: any) =>
          prisma.categorySetting.upsert({
            where: { family_code_category: { family_code: familyCode, category: c.category } },
            create: {
              family_code: familyCode,
              category: c.category,
              is_enabled: Boolean(c.isEnabled),
              display_order: Number(c.displayOrder) || 0,
            },
            update: {
              is_enabled: Boolean(c.isEnabled),
              display_order: Number(c.displayOrder) || 0,
            },
          })
        )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ PUT /api/settings/categories Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { ACTIVITY_CATEGORIES } from '../../../lib/activityCategories';

// Need at least this many logged start times (=> at least 2 intervals) before
// an average interval is meaningful enough to predict from.
const MIN_SAMPLES = 3;
const MAX_SAMPLES = 15;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyCode = searchParams.get('familyCode');
    if (!familyCode) {
      return NextResponse.json({ success: false, error: 'familyCode가 필요합니다.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const recommendations: Array<{
      category: string;
      label: string;
      emoji: string;
      sampleSize: number;
      avgIntervalMinutes: number;
      lastStartTime: string;
      predictedNextTime: string;
    }> = [];

    for (const def of ACTIVITY_CATEGORIES) {
      const rows = await prisma.activityLog.findMany({
        where: { family_code: familyCode, category: def.code },
        orderBy: { start_time: 'desc' },
        take: MAX_SAMPLES,
        select: { start_time: true },
      });
      if (rows.length < MIN_SAMPLES) continue;

      const times = rows.map((r) => r.start_time.getTime()).sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1]);
      const avgMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
      const lastStartMs = times[times.length - 1];

      recommendations.push({
        category: def.code,
        label: def.label,
        emoji: def.emoji,
        sampleSize: rows.length,
        avgIntervalMinutes: Math.round(avgMs / 60000),
        lastStartTime: new Date(lastStartMs).toISOString(),
        predictedNextTime: new Date(lastStartMs + avgMs).toISOString(),
      });
    }

    recommendations.sort((a, b) => new Date(a.predictedNextTime).getTime() - new Date(b.predictedNextTime).getTime());

    return NextResponse.json({ success: true, recommendations });
  } catch (error: any) {
    console.error('❌ GET /api/recommendations Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

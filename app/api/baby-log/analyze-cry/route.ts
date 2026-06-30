import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { avg_frequency, max_decibel, familyCode } = await request.json();

    if (typeof avg_frequency !== 'number' || typeof max_decibel !== 'number') {
      return NextResponse.json({ success: false, error: 'avg_frequency 및 max_decibel은 숫자여야 합니다.' }, { status: 400 });
    }

    const labels = [
      { max: 220, emoji: '😌', prediction: '아기가 안정된 상태에 있거나 가벼운 울음을 보내고 있어요.' },
      { max: 320, emoji: '😢', prediction: '배고픔 또는 불편함 신호일 수 있습니다. 잠시 확인해 보세요.' },
      { max: 420, emoji: '😟', prediction: '졸음이나 짜증이 섞인 울음일 수 있습니다. 케어가 필요합니다.' },
      { max: Infinity, emoji: '🚨', prediction: '강한 울음입니다. 빠르게 상태를 확인해주세요.' },
    ];

    const matched = labels.find((item) => avg_frequency <= item.max) ?? labels[labels.length - 1];
    const loudness = max_decibel > 120 ? '매우 큰 소리' : max_decibel > 80 ? '큰 소리' : '적당한 소리';

    return NextResponse.json({
      success: true,
      emoji: matched.emoji,
      prediction: `${matched.prediction} (소리: ${loudness}, 평균 주파수: ${avg_frequency}Hz)`,
      avg_frequency,
      max_decibel,
      familyCode: familyCode || null,
    });
  } catch (error: any) {
    console.error('❌ POST /api/baby-log/analyze-cry Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 내부 오류' }, { status: 500 });
  }
}

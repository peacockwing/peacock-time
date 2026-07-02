import { NextResponse } from 'next/server';
import { getAnthropic } from '../../../lib/anthropic';
import { getPrisma } from '../../../lib/prisma';

const MODEL = 'claude-opus-4-8';

const NEED_TYPES = ['HUNGER', 'SLEEPY', 'DISCOMFORT', 'PAIN', 'GAS', 'DIAPER', 'OVERSTIMULATION', 'BOREDOM', 'UNKNOWN'] as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    needs: {
      type: 'array',
      description: '2-4 ranked candidate needs, most likely first',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...NEED_TYPES] },
          likelihood: { type: 'string', enum: ['high', 'medium', 'low'] },
          reasoning: { type: 'string', description: 'One short Korean sentence citing specific acoustic features AND/OR logged context together, not generic' },
        },
        required: ['type', 'likelihood', 'reasoning'],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 4,
    },
    summary: { type: 'string', description: 'One-line Korean summary of the overall interpretation' },
    emoji: { type: 'string', description: 'A single emoji representing the top interpretation' },
    urgent: { type: 'boolean', description: 'true only if acoustic markers suggest a possible pain/distress cry warranting an immediate physical check' },
  },
  required: ['needs', 'summary', 'emoji', 'urgent'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a cry-interpretation assistant inside "피콕타임", a Korean childcare tracking app. You are given acoustic features engineered from a ~6 second recording of a baby's cry (fundamental frequency stats, loudness, spectral brightness, cry-burst/pause rhythm) plus the family's recent care-log context (hours since last feeding, last diaper change, sleep status). No audio is sent to you - only these numeric features.

Ground your interpretation in infant-cry acoustics research, not guesswork:
- Pain/distress cries: sudden high fundamental frequency (often sustained above ~600-700Hz, sometimes with erratic/very high spikes suggesting hyperphonation), harsher or less rhythmic bursts, high loudness, often less mixed with pauses (more continuous).
- Hunger cries: rhythmic, repeating burst-pause pattern (moderate burst count with fairly even pause spacing), moderate pitch that may rise/escalate, loudness builds gradually rather than starting at maximum intensity. Weight heavily if hours-since-last-feeding is large.
- Sleepy/overtired cries: fussier/whinier - lower average loudness, more irregular/sparser bursts, moderate pitch with high variability (f0Std), often shorter overall voiced ratio (more fussing than full crying).
- Gas/discomfort cries: irregular burst pattern, moderate pitch, less rhythmic than hunger cries; weight the logged context (recent feeding but not recent diaper/burp) more heavily than the acoustics alone since gas is acoustically ambiguous.
- Overstimulation/boredom cries: generally lower intensity, intermittent, lower urgency.
You may briefly mention that "Dunstan Baby Language" (Neh=hunger, Owh=sleepy, Heh=discomfort, Eh=needs burping, Eairh=gas pain) is a popular framework some parents reference, but make clear it is NOT a scientifically validated method - don't present it as proven fact.

You are not a medical professional and this is not a diagnosis. If the acoustic markers look pain-like (sustained very high pitch, harsh/erratic quality) or something seems off given the context, set urgent=true and say so plainly - encourage checking the baby now and consulting a pediatrician if the crying is unusual or doesn't resolve. Never let a "hunger" or "sleepy" guess discourage a parent from physically checking when acoustic markers are concerning.

Always cite BOTH the acoustic evidence and the logged-context evidence together in your reasoning where both are relevant - that combination is the whole point of this feature, not generic cry-type descriptions.`;

async function getRecentContext(prisma: ReturnType<typeof getPrisma>, familyCode: string) {
  const now = Date.now();
  const [lastFeeding, lastDiaper, lastSleep] = await Promise.all([
    prisma.activityLog.findFirst({
      where: { family_code: familyCode, category: { in: ['BREASTFEEDING', 'FORMULA', 'PUMPED_MILK_FEEDING'] } },
      orderBy: { start_time: 'desc' },
    }),
    prisma.activityLog.findFirst({ where: { family_code: familyCode, category: 'DIAPER' }, orderBy: { start_time: 'desc' } }),
    prisma.activityLog.findFirst({ where: { family_code: familyCode, category: 'SLEEP' }, orderBy: { start_time: 'desc' } }),
  ]);

  const hoursSince = (d: Date | null | undefined) => (d ? Math.round(((now - new Date(d).getTime()) / 3600000) * 10) / 10 : null);

  return {
    hoursSinceLastFeeding: hoursSince(lastFeeding?.start_time),
    hoursSinceLastDiaperChange: hoursSince(lastDiaper?.start_time),
    sleepStatus: lastSleep && !lastSleep.end_time ? 'currently asleep' : lastSleep ? `awake, last woke ${hoursSince(lastSleep.end_time)}h ago` : 'no sleep logged yet',
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { familyCode, features } = body;

    if (!features || typeof features !== 'object') {
      return NextResponse.json({ success: false, error: 'features가 필요합니다.' }, { status: 400 });
    }

    const anthropic = getAnthropic();

    let context: Record<string, any> | null = null;
    if (familyCode) {
      try {
        context = await getRecentContext(getPrisma(), familyCode);
      } catch (e) {
        context = null;
      }
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Acoustic features (from a ${Math.round((features.durationMs || 0) / 1000)}s recording):\n${JSON.stringify(features, null, 2)}\n\nFamily care-log context:\n${JSON.stringify(context, null, 2)}\n\nWhat does this baby most likely need right now?`,
        },
      ],
    } as any);

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ success: false, error: '분석할 수 없습니다.' }, { status: 422 });
    }

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock || !('text' in textBlock)) {
      return NextResponse.json({ success: false, error: '분석 결과를 읽을 수 없습니다.' }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text);

    return NextResponse.json({ success: true, ...parsed, features, context });
  } catch (error: any) {
    console.error('❌ POST /api/cry-analysis Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 내부 오류' }, { status: 500 });
  }
}

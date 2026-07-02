import { NextResponse } from 'next/server';
import { getAnthropic } from '../../../lib/anthropic';

const MODEL = 'claude-opus-4-8';

const SCHEMAS: Record<string, { prompt: string; schema: Record<string, unknown> }> = {
  FORMULA: {
    prompt:
      'This photo shows a baby formula bottle. Read the ml markings on the bottle to determine the filled level (the amount of formula in it), and identify the formula brand/type from the packaging if visible. If a value is not legible, return null for it rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        formula_type: {
          type: ['string', 'null'],
          description: 'Brand/type of formula visible on the bottle or packaging, or null if not identifiable',
        },
        target_amount_ml: {
          type: ['integer', 'null'],
          description: 'The ml measurement mark at the filled level of the bottle, or null if not readable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['formula_type', 'target_amount_ml', 'confidence'],
      additionalProperties: false,
    },
  },
  DIAPER: {
    prompt:
      "This photo shows a diaper's contents. Classify whether it contains urine, stool, or both, briefly describe the stool's color and consistency if present, and give a rough estimate of the stool's weight in grams based on visual volume. If something can't be determined, return null for it rather than guessing.",
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['PEE', 'POOP', 'BOTH'] },
        stool_state: {
          type: ['string', 'null'],
          description: "Brief description of color and consistency, e.g. 'yellow, seedy, normal' - null if type is PEE",
        },
        weight_g: {
          type: ['integer', 'null'],
          description: 'Estimated weight of the stool in grams based on visual volume, or null if not estimable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['type', 'stool_state', 'weight_g', 'confidence'],
      additionalProperties: false,
    },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, imageBase64, mediaType } = body;

    if (!category || !SCHEMAS[category]) {
      return NextResponse.json({ success: false, error: `지원하지 않는 category입니다: ${category}` }, { status: 400 });
    }
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: 'imageBase64가 필요합니다.' }, { status: 400 });
    }
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const resolvedMediaType = validMediaTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const { prompt, schema } = SCHEMAS[category];
    const anthropic = getAnthropic();

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: resolvedMediaType, data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    } as any);

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ success: false, error: '이미지를 분석할 수 없습니다.' }, { status: 422 });
    }

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock || !('text' in textBlock)) {
      return NextResponse.json({ success: false, error: '분석 결과를 읽을 수 없습니다.' }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json({ success: true, result: parsed });
  } catch (error: any) {
    console.error('❌ POST /api/photo-analysis Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || '서버 에러' }, { status: 500 });
  }
}

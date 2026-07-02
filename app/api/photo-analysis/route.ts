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
  PUMPED_MILK_FEEDING: {
    prompt:
      'This photo shows a bottle of pumped breast milk. Read the ml markings on the bottle to determine the filled level (the amount in the bottle). If not legible, return null rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        target_amount_ml: {
          type: ['integer', 'null'],
          description: 'The ml measurement mark at the filled level of the bottle, or null if not readable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['target_amount_ml', 'confidence'],
      additionalProperties: false,
    },
  },
  BABY_FOOD: {
    prompt:
      'This photo shows baby food or the ingredients being prepared for it. Identify the type of baby food (main ingredient or dish name). If not identifiable, return null rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        food_type: {
          type: ['string', 'null'],
          description: 'The type/name of the baby food or its main ingredient, or null if not identifiable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['food_type', 'confidence'],
      additionalProperties: false,
    },
  },
  SLEEP: {
    prompt:
      "This photo shows a baby sleeping. Based on visual cues like lighting (daylight vs dark/night lighting) and surroundings, judge whether this looks like a daytime nap or nighttime sleep. If it's genuinely ambiguous, return null rather than guessing.",
    schema: {
      type: 'object',
      properties: {
        sleep_type: {
          type: ['string', 'null'],
          enum: ['NAP', 'NIGHT', null],
          description: 'NAP if the photo suggests daytime, NIGHT if nighttime, null if unclear',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['sleep_type', 'confidence'],
      additionalProperties: false,
    },
  },
  MEDICATION: {
    prompt:
      "This photo shows a medication package, bottle, or label for a baby. Identify the medication's name if visible on the packaging. If not legible, return null rather than guessing.",
    schema: {
      type: 'object',
      properties: {
        medication_name: {
          type: ['string', 'null'],
          description: 'Name of the medication as printed on the packaging, or null if not legible',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['medication_name', 'confidence'],
      additionalProperties: false,
    },
  },
  SNACK: {
    prompt:
      'This photo shows a snack for a baby/toddler. Identify the type of snack and estimate its calorie content for a typical serving. If not identifiable, return null rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        snack_type: {
          type: ['string', 'null'],
          description: 'Name/type of the snack visible, or null if not identifiable',
        },
        calories: {
          type: ['integer', 'null'],
          description: 'Estimated calories for a typical serving of this snack, or null if not estimable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['snack_type', 'calories', 'confidence'],
      additionalProperties: false,
    },
  },
  MILK: {
    prompt:
      'This photo shows milk for a baby/toddler (carton, bottle, or cup). Identify the type/brand of milk and read the ml amount if a measurement marking is visible. If not identifiable, return null rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        milk_type: {
          type: ['string', 'null'],
          description: 'Type/brand of milk visible on packaging, or null if not identifiable',
        },
        amount_ml: {
          type: ['integer', 'null'],
          description: 'Amount of milk in ml if a measurement marking is visible, or null',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['milk_type', 'amount_ml', 'confidence'],
      additionalProperties: false,
    },
  },
  WATER: {
    prompt:
      'This photo shows water for a baby/toddler in a bottle or cup. Read the ml measurement marking to determine the amount. If not readable, return null rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        amount_ml: {
          type: ['integer', 'null'],
          description: 'Amount of water in ml based on a visible measurement marking, or null if not readable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['amount_ml', 'confidence'],
      additionalProperties: false,
    },
  },
  PLAY: {
    prompt:
      'This photo shows a baby/toddler playing. Identify the type of play or activity taking place (e.g. block play, reading, outdoor play). If not identifiable, return null rather than guessing.',
    schema: {
      type: 'object',
      properties: {
        play_type: {
          type: ['string', 'null'],
          description: 'Type of play/activity visible, or null if not identifiable',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['play_type', 'confidence'],
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

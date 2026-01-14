import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

// Email translation endpoint
// Translates existing emails from English to Spanish

interface TranslateRequest {
  subject: string;
  body: string;
  targetLanguage: 'spanish';
}

const TRANSLATION_SYSTEM_PROMPT = `Eres un traductor profesional especializado en comunicaciones de seguros.

Tu trabajo es traducir correos electrónicos de agentes de seguros del inglés al español, manteniendo:
- El tono profesional pero cálido
- La terminología de seguros apropiada
- El estilo natural y conversacional
- Los saltos de línea y formato

TERMINOLOGÍA CLAVE:
- policy → póliza
- coverage → cobertura
- premium → prima
- claim → reclamación
- quote → cotización
- renewal → renovación
- deductible → deducible
- carrier → aseguradora
- agent → agente

ESTILO:
- Mantén el mismo nivel de formalidad que el original
- Usa español latinoamericano neutral (no específico de un país)
- Mantén los nombres de personas, empresas y marcas sin traducir
- Traduce naturalmente, no palabra por palabra`;

export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    const { subject, body: emailBody, targetLanguage } = body;

    if (!subject || !emailBody || targetLanguage !== 'spanish') {
      return NextResponse.json(
        { success: false, error: 'Subject, body, and target language (spanish) are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `Traduce el siguiente correo electrónico del inglés al español, manteniendo el tono y estilo profesional de un agente de seguros:

ASUNTO:
${subject}

CUERPO:
${emailBody}

Genera una respuesta JSON con:
{
  "subject": "El asunto traducido",
  "body": "El cuerpo traducido (mantén los \\n para saltos de línea)"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: TRANSLATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse translation response');
    }

    const translatedData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      subject: translatedData.subject,
      body: translatedData.body,
    });

  } catch (error) {
    logger.error('Translation error', error, { component: 'TranslateEmailAPI' });
    return NextResponse.json(
      { success: false, error: 'Failed to translate email. Please try again.' },
      { status: 500 }
    );
  }
}

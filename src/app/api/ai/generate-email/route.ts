import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

// Customer email generation endpoint
// Generates professional update emails for internal staff to send to customers

interface TaskSummary {
  text: string;
  status: 'todo' | 'in_progress' | 'done';
  subtasksCompleted: number;
  subtasksTotal: number;
  notes?: string;
  dueDate?: string;
  transcription?: string;
  attachments?: Array<{ file_name: string; file_type: string }>;
  completed?: boolean;
}

interface EmailRequest {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  tasks: TaskSummary[];
  tone: 'formal' | 'friendly' | 'brief';
  language?: 'english' | 'spanish';
  senderName: string;
  includeNextSteps: boolean;
}

const SYSTEM_PROMPT = `You are a professional assistant helping insurance agency staff write customer update emails.

Your job is to generate clear, professional emails that update customers on the status of their insurance-related tasks.

INSURANCE AGENT COMMUNICATION STYLE:
- Use industry-appropriate language (e.g., "policy", "coverage", "premium", "claim", "quote", "renewal", "deductible", "carrier")
- Be warm and personal - insurance agents build long-term relationships with clients
- Show proactive care: "I wanted to reach out", "I'm making sure", "I'm keeping an eye on"
- Use reassuring language when appropriate: "you're all set", "everything is in order", "we've got you covered"
- Reference specific actions taken: "I spoke with the carrier", "I reviewed your policy", "I submitted the paperwork"

CONTENT GUIDELINES:
- Focus on what's been ACCOMPLISHED and what's NEXT
- If voicemail transcriptions are provided, use them to understand customer concerns and reference them naturally
- If attachments are mentioned, acknowledge them (e.g., "I've reviewed the documents you sent")
- If subtasks show detailed progress, use that to demonstrate thoroughness
- For completed tasks, be clear about outcomes and next steps
- Never expose internal details (task IDs, systems, internal notes that aren't relevant)
- Keep it concise - 2-4 short paragraphs max
- Be specific about what was done without being overly technical

Status meanings:
- "todo": Not started yet (be honest but reassuring)
- "in_progress": Currently being worked on (show active progress)
- "done": Completed (celebrate the accomplishment)

Do NOT:
- Use bullet points (write in natural paragraphs)
- Start with "I hope this email finds you well"
- Be overly formal or stiff
- Include placeholder text like [DATE] or [NAME]
- Mention the task management system
- Make promises about timing without context

REVIEW FLAGS:
You must also identify potential issues that the agent should review before sending:
- Sensitive information that might be in notes/transcriptions (SSNs, account numbers, private health info)
- Promises about specific dates or timelines
- Statements about coverage or policy details that should be verified
- Any placeholder information that needs to be filled in
- Negative news that may need softer delivery
- Mentions of money, payments, or pricing that should be double-checked`;

const SPANISH_SYSTEM_PROMPT = `Eres un asistente profesional que ayuda al personal de agencias de seguros a escribir correos electrónicos de actualización para clientes.

Tu trabajo es generar correos electrónicos claros y profesionales que actualicen a los clientes sobre el estado de sus asuntos relacionados con seguros.

ESTILO DE COMUNICACIÓN DE AGENTE DE SEGUROS:
- Usa lenguaje apropiado de la industria (por ejemplo, "póliza", "cobertura", "prima", "reclamación", "cotización", "renovación", "deducible", "aseguradora")
- Sé cálido y personal - los agentes de seguros construyen relaciones a largo plazo con los clientes
- Muestra cuidado proactivo: "Quería comunicarme", "Me estoy asegurando", "Estoy pendiente"
- Usa lenguaje tranquilizador cuando sea apropiado: "todo está listo", "todo está en orden", "te tenemos cubierto"
- Referencia acciones específicas tomadas: "Hablé con la aseguradora", "Revisé tu póliza", "Presenté la documentación"

PAUTAS DE CONTENIDO:
- Enfócate en lo que se ha LOGRADO y lo que SIGUE
- Si se proporcionan transcripciones de mensajes de voz, úsalas para entender las preocupaciones del cliente y referenciarlas naturalmente
- Si se mencionan archivos adjuntos, reconócelos (por ejemplo, "He revisado los documentos que enviaste")
- Si las subtareas muestran progreso detallado, úsalo para demostrar minuciosidad
- Para tareas completadas, sé claro sobre los resultados y los próximos pasos
- Nunca expongas detalles internos (IDs de tareas, sistemas, notas internas que no son relevantes)
- Manténlo conciso - máximo 2-4 párrafos cortos
- Sé específico sobre lo que se hizo sin ser demasiado técnico

Significados de estados:
- "todo": Aún no comenzado (sé honesto pero tranquilizador)
- "in_progress": Actualmente en progreso (muestra avance activo)
- "done": Completado (celebra el logro)

NO:
- Usar viñetas (escribe en párrafos naturales)
- Comenzar con "Espero que este correo te encuentre bien"
- Ser demasiado formal o rígido
- Incluir texto de marcador de posición como [FECHA] o [NOMBRE]
- Mencionar el sistema de gestión de tareas
- Hacer promesas sobre tiempos sin contexto

SEÑALES DE REVISIÓN:
También debes identificar problemas potenciales que el agente debe revisar antes de enviar:
- Información sensible que podría estar en notas/transcripciones (SSNs, números de cuenta, información de salud privada)
- Promesas sobre fechas o plazos específicos
- Declaraciones sobre cobertura o detalles de póliza que deben ser verificados
- Cualquier información de marcador de posición que necesite ser completada
- Noticias negativas que puedan necesitar una entrega más suave
- Menciones de dinero, pagos o precios que deben ser verificados`;

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();
    const { customerName, customerEmail, customerPhone, tasks, tone, language = 'english', senderName, includeNextSteps } = body;

    if (!customerName || !tasks || tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer name and at least one task are required' },
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

    // Build detailed task summary for the prompt
    const taskSummary = tasks.map((t, i) => {
      const statusLabel = t.status === 'done' || t.completed ? 'Completed' : t.status === 'in_progress' ? 'In Progress' : 'Pending';
      const subtaskInfo = t.subtasksTotal > 0 ? ` (${t.subtasksCompleted}/${t.subtasksTotal} steps completed)` : '';
      const dueInfo = t.dueDate ? ` - Due: ${t.dueDate}` : '';
      const notesInfo = t.notes ? `\n   Notes: ${t.notes}` : '';
      const transcriptionInfo = t.transcription ? `\n   Voicemail: ${t.transcription}` : '';
      const attachmentInfo = t.attachments && t.attachments.length > 0
        ? `\n   Attachments: ${t.attachments.map(a => `${a.file_name} (${a.file_type})`).join(', ')}`
        : '';
      return `${i + 1}. ${t.text} - ${statusLabel}${subtaskInfo}${dueInfo}${notesInfo}${transcriptionInfo}${attachmentInfo}`;
    }).join('\n\n');

    // Calculate overall progress
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'todo').length;

    const toneInstructions = language === 'spanish' ? {
      formal: 'Usa un tono formal y profesional apropiado para correspondencia de negocios.',
      friendly: 'Usa un tono cálido y amigable mientras te mantienes profesional. Esta es una agencia pequeña con relaciones personales.',
      brief: 'Manténlo muy corto y directo al grano - solo la actualización esencial en máximo 2-3 oraciones.',
    } : {
      formal: 'Use a formal, professional tone suitable for business correspondence.',
      friendly: 'Use a warm, friendly tone while remaining professional. This is a small agency with personal relationships.',
      brief: 'Keep it very short and to the point - just the essential update in 2-3 sentences max.',
    };

    const promptDetails = language === 'spanish' ? `
Nombre del Cliente: ${customerName}
${customerEmail ? `Email del Cliente: ${customerEmail}` : ''}
${customerPhone ? `Teléfono del Cliente: ${customerPhone}` : ''}
Nombre del Remitente: ${senderName}
Agencia: Bealer Agency

Resumen de Tareas (${completed} completadas, ${inProgress} en progreso, ${pending} pendientes):
${taskSummary}

Tono: ${toneInstructions[tone]}
${includeNextSteps ? 'Incluye próximos pasos específicos o qué puede esperar el cliente.' : 'Mantén el enfoque solo en la actualización de estado.'}

IMPORTANTE: Revisa los detalles de las tareas cuidadosamente. Si se proporcionan transcripciones de mensajes de voz, úsalas para entender el contexto y las preocupaciones del cliente. Si se mencionan archivos adjuntos, reconócelos apropiadamente. Presta atención al progreso de las subtareas para mostrar minuciosidad.

Genera una respuesta JSON con:
{
  "subject": "Línea de asunto breve y específica del correo electrónico",
  "body": "El cuerpo del correo electrónico (usa \\n para saltos de línea entre párrafos)",
  "suggestedFollowUp": "Opcional: cuándo hacer seguimiento (por ejemplo, 'en 2-3 días') o null",
  "warnings": [
    {
      "type": "sensitive_info" | "date_promise" | "coverage_detail" | "pricing" | "negative_news" | "needs_verification",
      "message": "Breve descripción de qué revisar",
      "location": "Dónde aparece esto en el correo (subject/body)"
    }
  ]
}

El array de warnings debe señalar cualquier elemento que necesite la revisión del agente antes de enviar. Solo incluye warnings si hay problemas reales para revisar.` : `
Customer Name: ${customerName}
${customerEmail ? `Customer Email: ${customerEmail}` : ''}
${customerPhone ? `Customer Phone: ${customerPhone}` : ''}
Sender Name: ${senderName}
Agency: Bealer Agency

Task Summary (${completed} completed, ${inProgress} in progress, ${pending} pending):
${taskSummary}

Tone: ${toneInstructions[tone]}
${includeNextSteps ? 'Include specific next steps or what the customer can expect.' : 'Keep focus on status update only.'}

IMPORTANT: Review the task details carefully. If voicemail transcriptions are provided, use them to understand context and customer concerns. If attachments are mentioned, acknowledge them appropriately. Pay attention to subtask progress to show thoroughness.

Generate a JSON response with:
{
  "subject": "Brief, specific email subject line",
  "body": "The email body (use \\n for line breaks between paragraphs)",
  "suggestedFollowUp": "Optional: when to follow up (e.g., 'in 2-3 days') or null",
  "warnings": [
    {
      "type": "sensitive_info" | "date_promise" | "coverage_detail" | "pricing" | "negative_news" | "needs_verification",
      "message": "Brief description of what to review",
      "location": "Where in the email this appears (subject/body)"
    }
  ]
}

The warnings array should flag any items that need the agent's review before sending. Only include warnings if there are actual issues to review.`;

    const prompt = (language === 'spanish'
      ? `Genera un correo electrónico de actualización para el cliente con los siguientes detalles:`
      : `Generate a customer update email with the following details:`) + promptDetails;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: language === 'spanish' ? SPANISH_SYSTEM_PROMPT : SYSTEM_PROMPT,
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
      throw new Error('Could not parse email response');
    }

    const emailData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      subject: emailData.subject,
      body: emailData.body,
      suggestedFollowUp: emailData.suggestedFollowUp || null,
      warnings: emailData.warnings || [],
    });

  } catch (error) {
    logger.error('Email generation error', error, { component: 'GenerateEmailAPI' });
    return NextResponse.json(
      { success: false, error: 'Failed to generate email. Please try again.' },
      { status: 500 }
    );
  }
}

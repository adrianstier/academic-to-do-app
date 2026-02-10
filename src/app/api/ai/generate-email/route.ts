import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { withTeamAuth } from '@/lib/teamAuth';

// Professional email generation endpoint
// Generates professional update emails for team members to send to collaborators, advisors, and stakeholders

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
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  // Backward compatibility aliases
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  tasks: TaskSummary[];
  tone: 'formal' | 'friendly' | 'brief';
  language?: 'english' | 'spanish';
  senderName: string;
  includeNextSteps: boolean;
}

const SYSTEM_PROMPT = `You are a professional assistant helping academic researchers and team members write professional correspondence emails.

Your job is to generate clear, professional emails that update collaborators, advisors, students, or other stakeholders on the status of research-related tasks.

ACADEMIC COMMUNICATION STYLE:
- Use scholarly but accessible language (e.g., "manuscript", "submission", "methodology", "findings", "analysis", "revision", "feedback")
- Be collegial and collaborative - academics work in partnership with mentors, peers, and students
- Show progress and momentum: "I wanted to update you on", "We've made good progress on", "I'm following up on"
- Use professional academic tone: "I appreciate your feedback", "I look forward to discussing", "Please let me know if you have any questions"
- Reference specific work completed: "I've completed the analysis", "The draft is ready for review", "I've incorporated your suggestions"

CONTENT GUIDELINES:
- Focus on what's been ACCOMPLISHED and what's NEXT
- If meeting notes or transcriptions are provided, use them to understand context and reference them naturally
- If attachments are mentioned, acknowledge them (e.g., "I've attached the updated draft", "Please find the data files attached")
- If subtasks show detailed progress, use that to demonstrate thoroughness
- For completed tasks, be clear about outcomes and next steps
- Never expose internal details (task IDs, systems, internal notes that aren't relevant)
- Keep it concise - 2-4 short paragraphs max
- Be specific about what was done without being overly technical

Status meanings:
- "todo": Not started yet (be honest but provide timeline if possible)
- "in_progress": Currently being worked on (show active progress)
- "done": Completed (summarize the accomplishment)

Do NOT:
- Use bullet points (write in natural paragraphs)
- Start with "I hope this email finds you well"
- Be overly formal or stiff
- Include placeholder text like [DATE] or [NAME]
- Mention the task management system
- Make promises about timing without context

REVIEW FLAGS:
You must also identify potential issues that the sender should review before sending:
- Sensitive information that might be in notes/transcriptions (student grades, unpublished data, confidential reviews)
- Promises about specific dates or timelines (submission deadlines, meeting times)
- Statements about research findings or methodology that should be verified
- Any placeholder information that needs to be filled in
- Negative news that may need softer delivery (rejection notices, delays, issues)
- Mentions of funding, budgets, or financial matters that should be double-checked`;

const SPANISH_SYSTEM_PROMPT = `Eres un asistente profesional que ayuda a investigadores académicos y miembros del equipo a escribir correos electrónicos de correspondencia profesional.

Tu trabajo es generar correos electrónicos claros y profesionales que actualicen a colaboradores, asesores, estudiantes u otras partes interesadas sobre el estado de las tareas relacionadas con la investigación.

ESTILO DE COMUNICACIÓN ACADÉMICA:
- Usa lenguaje académico pero accesible (por ejemplo, "manuscrito", "envío", "metodología", "hallazgos", "análisis", "revisión", "retroalimentación")
- Sé colegial y colaborativo - los académicos trabajan en asociación con mentores, colegas y estudiantes
- Muestra progreso e impulso: "Quería actualizarte sobre", "Hemos avanzado bien en", "Estoy dando seguimiento a"
- Usa tono académico profesional: "Agradezco tu retroalimentación", "Espero poder discutirlo", "Por favor déjame saber si tienes preguntas"
- Referencia trabajo específico completado: "He completado el análisis", "El borrador está listo para revisión", "He incorporado tus sugerencias"

PAUTAS DE CONTENIDO:
- Enfócate en lo que se ha LOGRADO y lo que SIGUE
- Si se proporcionan notas de reunión o transcripciones, úsalas para entender el contexto y referenciarlas naturalmente
- Si se mencionan archivos adjuntos, reconócelos (por ejemplo, "Adjunto el borrador actualizado", "Por favor encuentra los archivos de datos adjuntos")
- Si las subtareas muestran progreso detallado, úsalo para demostrar minuciosidad
- Para tareas completadas, sé claro sobre los resultados y los próximos pasos
- Nunca expongas detalles internos (IDs de tareas, sistemas, notas internas que no son relevantes)
- Manténlo conciso - máximo 2-4 párrafos cortos
- Sé específico sobre lo que se hizo sin ser demasiado técnico

Significados de estados:
- "todo": Aún no comenzado (sé honesto pero proporciona cronograma si es posible)
- "in_progress": Actualmente en progreso (muestra avance activo)
- "done": Completado (resume el logro)

NO:
- Usar viñetas (escribe en párrafos naturales)
- Comenzar con "Espero que este correo te encuentre bien"
- Ser demasiado formal o rígido
- Incluir texto de marcador de posición como [FECHA] o [NOMBRE]
- Mencionar el sistema de gestión de tareas
- Hacer promesas sobre tiempos sin contexto

SEÑALES DE REVISIÓN:
También debes identificar problemas potenciales que el remitente debe revisar antes de enviar:
- Información sensible que podría estar en notas/transcripciones (calificaciones de estudiantes, datos no publicados, revisiones confidenciales)
- Promesas sobre fechas o plazos específicos (fechas límite de envío, horarios de reuniones)
- Declaraciones sobre hallazgos de investigación o metodología que deben ser verificados
- Cualquier información de marcador de posición que necesite ser completada
- Noticias negativas que puedan necesitar una entrega más suave (notificaciones de rechazo, retrasos, problemas)
- Menciones de financiamiento, presupuestos o asuntos financieros que deben ser verificados`;

export const POST = withTeamAuth(async (request, context) => {
  try {
    const body: EmailRequest = await request.json();
    // Support both new field names and backward-compatible old names
    const recipientName = body.recipientName || body.customerName;
    const recipientEmail = body.recipientEmail || body.customerEmail;
    const recipientPhone = body.recipientPhone || body.customerPhone;
    const { tasks, tone, language = 'english', senderName, includeNextSteps } = body;

    if (!recipientName || !tasks || tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recipient name and at least one task are required' },
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
      friendly: 'Usa un tono cálido y amigable mientras te mantienes profesional. Este es un equipo académico colaborativo.',
      brief: 'Manténlo muy corto y directo al grano - solo la actualización esencial en máximo 2-3 oraciones.',
    } : {
      formal: 'Use a formal, professional tone suitable for business correspondence.',
      friendly: 'Use a warm, friendly tone while remaining professional. This is a collaborative academic team.',
      brief: 'Keep it very short and to the point - just the essential update in 2-3 sentences max.',
    };

    const promptDetails = language === 'spanish' ? `
Nombre del Destinatario: ${recipientName}
${recipientEmail ? `Email del Destinatario: ${recipientEmail}` : ''}
${recipientPhone ? `Teléfono del Destinatario: ${recipientPhone}` : ''}
Nombre del Remitente: ${senderName}
Organizacion: Equipo de Investigacion Academica

Resumen de Tareas (${completed} completadas, ${inProgress} en progreso, ${pending} pendientes):
${taskSummary}

Tono: ${toneInstructions[tone]}
${includeNextSteps ? 'Incluye proximos pasos especificos o que puede esperar el destinatario.' : 'Manten el enfoque solo en la actualizacion de estado.'}

IMPORTANTE: Revisa los detalles de las tareas cuidadosamente. Si se proporcionan notas de reuniones o transcripciones, úsalas para entender el contexto. Si se mencionan archivos adjuntos, reconócelos apropiadamente. Presta atención al progreso de las subtareas para mostrar minuciosidad.

Genera una respuesta JSON con:
{
  "subject": "Línea de asunto breve y específica del correo electrónico",
  "body": "El cuerpo del correo electrónico (usa \\n para saltos de línea entre párrafos)",
  "suggestedFollowUp": "Opcional: cuándo hacer seguimiento (por ejemplo, 'en 2-3 días') o null",
  "warnings": [
    {
      "type": "sensitive_info" | "date_promise" | "research_detail" | "funding" | "negative_news" | "needs_verification",
      "message": "Breve descripción de qué revisar",
      "location": "Dónde aparece esto en el correo (subject/body)"
    }
  ]
}

El array de warnings debe señalar cualquier elemento que necesite la revisión del remitente antes de enviar. Solo incluye warnings si hay problemas reales para revisar.` : `
Recipient Name: ${recipientName}
${recipientEmail ? `Recipient Email: ${recipientEmail}` : ''}
${recipientPhone ? `Recipient Phone: ${recipientPhone}` : ''}
Sender Name: ${senderName}
Organization: Academic Research Team

Task Summary (${completed} completed, ${inProgress} in progress, ${pending} pending):
${taskSummary}

Tone: ${toneInstructions[tone]}
${includeNextSteps ? 'Include specific next steps or what the recipient can expect.' : 'Keep focus on status update only.'}

IMPORTANT: Review the task details carefully. If meeting notes or transcriptions are provided, use them to understand context. If attachments are mentioned, acknowledge them appropriately. Pay attention to subtask progress to show thoroughness.

Generate a JSON response with:
{
  "subject": "Brief, specific email subject line",
  "body": "The email body (use \\n for line breaks between paragraphs)",
  "suggestedFollowUp": "Optional: when to follow up (e.g., 'in 2-3 days') or null",
  "warnings": [
    {
      "type": "sensitive_info" | "date_promise" | "research_detail" | "funding" | "negative_news" | "needs_verification",
      "message": "Brief description of what to review",
      "location": "Where in the email this appears (subject/body)"
    }
  ]
}

The warnings array should flag any items that need the sender's review before sending. Only include warnings if there are actual issues to review.`;

    const prompt = (language === 'spanish'
      ? `Genera un correo electrónico de actualización profesional con los siguientes detalles:`
      : `Generate a professional update email with the following details:`) + promptDetails;

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
});

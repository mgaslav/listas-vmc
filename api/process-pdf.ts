import { VercelRequest, VercelResponse } from '@vercel/node';
const pdfParse = require('pdf-parse');

const OPENAI_MODEL = 'gpt-4o';

/**
 * Splits the PDF text into chunks, each containing approximately `weeksPerChunk` weeks.
 * Weeks are delimited by date patterns like "X de month" or specific week header patterns.
 */
function splitPdfByWeeks(pdfText: string, weeksPerChunk: number = 2): string[] {
  // Match typical VMC week delimiters: "X-Y de month" or "X de month"  
  const weekPattern = /(?=\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/gi;
  
  const matches = [...pdfText.matchAll(weekPattern)];
  
  if (matches.length <= 1) {
    // Can't split reliably, return the whole text
    return [pdfText];
  }

  const chunks: string[] = [];
  for (let i = 0; i < matches.length; i += weeksPerChunk) {
    const startIdx = matches[i].index!;
    const endIdx = (i + weeksPerChunk < matches.length) ? matches[i + weeksPerChunk].index! : pdfText.length;
    chunks.push(pdfText.slice(startIdx, endIdx));
  }

  return chunks;
}

const schemaInstrucciones = `
Asegúrate de retornar ESTRICTAMENTE un objeto JSON con la siguiente estructura, sin markdown ni explicaciones adicionales:
{
  "semanas": [
    {
      "fecha_lunes": "YYYY-MM-DD",
      "lectura_semanal": "string",
      "cancion_inicio": "string",
      "cancion_intermedia": "string",
      "cancion_conclusion": "string",
      "partes": [
        {
          "tipo_asignacion": "string",
          "etiqueta": "string",
          "seccion": "string",
          "es_ayudante": boolean,
          "sugerencia_nombre_completo": "string"
        }
      ]
    }
  ]
}
`;

const promptInstructions = `Analiza detalladamente el siguiente texto extraído de la Guía de Actividades para la reunión Vida y Ministerio Cristianos (VMC).
Tu tarea es extraer absolutamente TODAS las semanas y TODAS sus partes de la reunión conservando de forma estricta el orden de aparición original.

Reglas estrictas:
1. Formatea la fecha de cada lunes en YYYY-MM-DD.
2. Identifica la lectura de la Biblia semanal correspondiente a esa semana (ej. "PROVERBIOS 29", "PROVERBIOS 30").
3. Identifica las tres canciones para la semana:
   - La canción de inicio (habitualmente al inicio del programa o del texto de la semana).
   - La canción intermedia (habitualmente al inicio de la sección Nuestra Vida Cristiana, ej. "Canción 159" o "Canción 80").
   - La canción de conclusión (al final del programa de la semana).
4. NUNCA inventes nombres de asignaciones. Usa EXACTAMENTE el texto del documento. Si el texto viene pegado (ej. "Busquemosperlasescondidas"), sepáralo correctamente con espacios ("Busquemos perlas escondidas").
5. Conserva strictly el orden secuencial de aparición de las asignaciones tal como se listan en el PDF para cada semana.
6. Sección "Tesoros de la Biblia" ('seccion': 'tesoros'):
   - Extrae Discurso de 10 min -> tipo_asignacion: 'discurso_tesoros', es_ayudante: false.
   - "Busquemos perlas escondidas" -> tipo_asignacion: 'buscar_perlas', es_ayudante: false. (NUNCA requiere ayudante).
   - "Lectura de la Biblia" -> tipo_asignacion: 'lectura_biblia', es_ayudante: false.
7. Sección "Seamos Mejores Maestros" ('seccion': 'maestros'): En el PDF, cada asignación de esta sección viene numerada secuencialmente (ej. "4. Empiece conversaciones", "5. Empiece conversaciones", "6. Haga revisitas").
   - Extrae EXACTAMENTE las partes que aparezcan listadas con número en esa semana y respetando su cantidad (si hay dos, extrae dos). NO agregues partes que no existan en el texto de esa semana.
   - Clasifícalas como: 'empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'que_diria' o 'discurso_estudiantil'.
   - Determina es_ayudante basándote únicamente en estas reglas:
     * SÍ llevan ayudante (es_ayudante = true): 'empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias'.
     * NO llevan ayudante (es_ayudante = false): 'que_diria', 'discurso_estudiantil'.
8. Sección "Nuestra Vida Cristiana" ('seccion': 'vida'):
   - "Estudio Bíblico de la Congregación": Extrae esta parte como una sola asignación con tipo_asignacion: 'conductor_estudio', es_ayudante: true. SIEMPRE debe ser la ÚLTIMA parte de la sección 'vida'. Si hay otras partes de vida cristiana, el estudio bíblico va al final.
   - Otras partes de la sección (ej. Necesidades locales, "En esta campaña, ni un golpe al aire", "Logros de la organización", etc.): Clasifícalas como tipo_asignacion: 'vida_cristiana', es_ayudante: false. NO omitas ninguna parte y respeta el orden original.
   - IMPORTANTE: El orden dentro de 'vida' debe ser: primero las partes de vida_cristiana, y al FINAL el conductor_estudio.`;

async function callOpenAI(apiKey: string, pdfText: string): Promise<any> {
  const openAiUrl = 'https://api.openai.com/v1/chat/completions';

  const promptText = `${promptInstructions}

Aquí está el texto extraído del PDF:
"""
${pdfText}
"""

${schemaInstrucciones}
`;

  const payload = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a precise data extraction assistant. You MUST return ONLY a valid JSON object. Do not include markdown code blocks (like ```json), do not include any conversational text before or after the JSON. Output raw JSON only."
      },
      {
        role: "user",
        content: promptText
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
  };

  const response = await fetch(openAiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError = '';
    try {
      const errorJson = JSON.parse(errorText);
      parsedError = errorJson?.error?.message || errorText;
    } catch {
      parsedError = errorText;
    }
    const error: any = new Error(`[OpenAI API] Status ${response.status}: ${parsedError}`);
    error.status = response.status;
    error.isQuotaError = response.status === 429;
    error.isAuthError = response.status === 401;
    error.isPaymentError = response.status === 402;
    error.openAiDetail = parsedError;
    throw error;
  }

  const result: any = await response.json();
  let candidateText = result.choices?.[0]?.message?.content;

  if (!candidateText) {
    throw new Error(`[OpenAI API] No se recibió contenido válido.`);
  }

  // A veces los modelos incluyen markdown a pesar de las instrucciones
  candidateText = candidateText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(candidateText);
  } catch (e) {
    console.error("Failed to parse OpenAI response as JSON:", candidateText);
    throw new Error("La IA no retornó un JSON válido.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pdfBase64 } = req.body;

  if (!pdfBase64) {
    return res.status(400).json({ error: 'Falta el campo pdfBase64 en la petición' });
  }

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY no está configurada');
    return res.status(500).json({
      error: 'La API Key de OpenAI no está configurada en las variables de entorno del servidor.'
    });
  }

  try {
    console.log("Convirtiendo PDF base64 a buffer...");
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    
    console.log("Extrayendo texto del PDF...");
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;
    
    if (!pdfText || pdfText.trim() === '') {
      return res.status(400).json({ error: 'No se pudo extraer texto del PDF (probablemente es una imagen escaneada sin OCR).' });
    }

    console.log(`Texto extraído exitosamente (${pdfText.length} caracteres). Dividiendo en chunks...`);

    // Split the PDF text into manageable chunks to avoid gpt-4o TPM limits
    const chunks = splitPdfByWeeks(pdfText, 2);
    console.log(`PDF dividido en ${chunks.length} chunk(s). Procesando con OpenAI (${OPENAI_MODEL})...`);

    const allSemanas: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Procesando chunk ${i + 1}/${chunks.length} (${chunks[i].length} caracteres)...`);
      
      const chunkResult = await callOpenAI(apiKey, chunks[i]);
      
      if (chunkResult.semanas && Array.isArray(chunkResult.semanas)) {
        allSemanas.push(...chunkResult.semanas);
      }

      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Procesamiento con OpenAI exitoso. ${allSemanas.length} semana(s) extraídas.`);
    return res.status(200).json({ semanas: allSemanas });

  } catch (error: any) {
    console.error('Excepción en process-pdf serverless function:', error);
    
    if (error.isQuotaError) {
      return res.status(429).json({
        error: `Límite de tasa de OpenAI alcanzado (429). Detalle: ${error.openAiDetail || error.message || error}`,
        errorType: 'rate_limit'
      });
    }

    if (error.isAuthError) {
      return res.status(401).json({
        error: `Error de autenticación con OpenAI (401). La API Key puede ser inválida o estar expirada. Detalle: ${error.openAiDetail || error.message || error}`,
        errorType: 'auth_error'
      });
    }

    if (error.isPaymentError) {
      return res.status(402).json({
        error: `Error de pago con OpenAI (402). Tu cuenta no tiene saldo suficiente. Detalle: ${error.openAiDetail || error.message || error}`,
        errorType: 'payment_error'
      });
    }

    return res.status(500).json({
      error: `Error al procesar el PDF: ${error.openAiDetail || error.message || error}`,
      errorType: 'server_error'
    });
  }
}

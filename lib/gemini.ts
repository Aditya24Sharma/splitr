import { GoogleGenAI, Type } from '@google/genai'
import { ParsedReceipt } from '@/lib/types'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const SYSTEM = `You extract structured data from US grocery receipts (Walmart, Sam's Club).
Expand cryptic item abbreviations into readable names (e.g. "GVGRK LT VA" -> "Great Value Greek Light Vanilla Yogurt").
Resolve weighted lines ("1.67 lb @ 1.27/lb") and multi-buy ("2 AT 1 FOR 0.97") into quantity, unitPrice, lineTotal.
Combine nothing; one row per printed line item. All prices in dollars. Use null when unknown.`

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    store: { type: Type.STRING, nullable: true },
    purchasedAt: { type: Type.STRING, nullable: true },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rawName: { type: Type.STRING, nullable: true },
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER },
          lineTotal: { type: Type.NUMBER },
        },
        required: ['name', 'quantity', 'unitPrice', 'lineTotal'],
      },
    },
    subtotal: { type: Type.NUMBER },
    tax: { type: Type.NUMBER },
    total: { type: Type.NUMBER },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['items', 'subtotal', 'tax', 'total'],
}

export function validateParsedReceipt(r: ParsedReceipt): string[] {
  const w: string[] = []
  const c = (n: number) => Math.round(n * 100)
  const itemsSum = r.items.reduce((a, i) => a + c(i.lineTotal), 0)
  if (Math.abs(itemsSum - c(r.subtotal)) > 3) {
    w.push(`Items ($${(itemsSum / 100).toFixed(2)}) don't match subtotal ($${r.subtotal.toFixed(2)})`)
  }
  if (Math.abs(c(r.subtotal) + c(r.tax) - c(r.total)) > 3) {
    w.push(`Subtotal + tax doesn't match total ($${r.total.toFixed(2)})`)
  }
  return w
}

export async function parseReceiptImage(jpeg: Buffer): Promise<ParsedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY missing')

  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } },
          { text: 'Extract this receipt as JSON.' },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
    },
  })

  // response.text is typed string | undefined — guard before parse
  const text = res.text
  if (!text) throw new Error('Gemini returned no text')

  let parsed: ParsedReceipt
  try {
    parsed = JSON.parse(text) as ParsedReceipt
  } catch {
    throw new Error(`Gemini returned unparseable JSON: ${text.slice(0, 120)}`)
  }
  parsed.warnings = [...(parsed.warnings ?? []), ...validateParsedReceipt(parsed)]
  return parsed
}

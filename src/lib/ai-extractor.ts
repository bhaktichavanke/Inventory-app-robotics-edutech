import { PRODUCT_CATEGORIES } from './categories'

export interface ExtractedItem {
  partNo: string | null
  description: string | null
  category: string | null
  quantity: number | null
  unitPrice: number | null
  baseAmount: number | null
  gstAmount: number | null
  totalAmount: number | null
  flags: {
    partNo?: boolean
    description?: boolean
    category?: boolean
    quantity?: boolean
    unitPrice?: boolean
    baseAmount?: boolean
    gstAmount?: boolean
    totalAmount?: boolean
  }
}

export interface ExtractionResult {
  invoiceNo: string | null
  poNumber: string | null
  invoiceDate: string | null
  supplierName: string | null
  baseAmount: number | null
  gstAmount: number | null
  cgst: number | null
  sgst: number | null
  igst: number | null
  otherTax: number | null
  totalAmount: number | null
  items: ExtractedItem[]
  flags: {
    invoiceNo?: boolean
    poNumber?: boolean
    invoiceDate?: boolean
    supplierName?: boolean
    baseAmount?: boolean
    gstAmount?: boolean
    totalAmount?: boolean
  }
  rawText?: string
  error?: string
}

// Single source of truth for product categories — imported by both the AI
// extraction prompt and the frontend forms so the dropdown options and the
// values the AI is allowed to pick from never drift apart.
const EXTRACTION_PROMPT = `You are an expert invoice data extractor. Analyze this invoice image/document and extract all information in valid JSON format.

IMPORTANT RULES:
1. Extract ALL line items — the invoice may have multiple products
2. If you are UNCERTAIN about a field, set its value to null and add the field name to the "flags" object with value true
3. For Indian invoices: look for CGST, SGST, IGST separately
4. For amounts: return numbers only (no currency symbols, commas, or spaces)
5. For dates: return as YYYY-MM-DD format
6. For quantities: return as numbers
7. Do NOT guess — return null if you cannot read a value clearly
8. For each line item's "category", classify it into exactly ONE of these values based on the item description: ${PRODUCT_CATEGORIES.join(', ')}. Use "General" if none of the more specific categories clearly fit — never invent a new category name.
9. A part/model number ("partNo") may genuinely be absent from the invoice — that's normal, return null rather than guessing one.

Return ONLY this JSON structure (no markdown, no explanation):
{
  "invoiceNo": "string or null",
  "poNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "supplierName": "string or null",
  "baseAmount": number or null,
  "gstAmount": number or null,
  "cgst": number or null,
  "sgst": number or null,
  "igst": number or null,
  "otherTax": number or null,
  "totalAmount": number or null,
  "flags": {
    "fieldName": true
  },
  "items": [
    {
      "partNo": "string or null",
      "description": "string or null",
      "category": "one of: ${PRODUCT_CATEGORIES.join(', ')}",
      "quantity": number or null,
      "unitPrice": number or null,
      "baseAmount": number or null,
      "gstAmount": number or null,
      "totalAmount": number or null,
      "flags": {
        "fieldName": true
      }
    }
  ]
}`

// Model fallback chain — tried in order until one succeeds. Kept as a list
// (rather than a single hardcoded name) because Google periodically
// deprecates/renames Gemini model IDs; "gemini-flash-latest" is Google's
// self-updating alias and acts as a safety net if the pinned model below
// is retired.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest']

export async function extractInvoiceData(
  imageInput: string | Buffer,
  mimeType: string,
  apiKey?: string
): Promise<ExtractionResult> {
  const key = apiKey || process.env.GEMINI_API_KEY

  if (!key) {
    return extractionError(
      'No Gemini API key configured. Add it in Settings, or set GEMINI_API_KEY in your environment. Get a free key at https://aistudio.google.com/apikey'
    )
  }

  const fs = await import('fs/promises')
  const buffer = Buffer.isBuffer(imageInput) ? imageInput : await fs.readFile(imageInput)

  try {
    return await extractWithGemini(buffer, mimeType, key)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return extractionError(`AI extraction failed: ${message}`)
  }
}

async function extractWithGemini(buffer: Buffer, mimeType: string, apiKey: string): Promise<ExtractionResult> {
  const effectiveMime =
    mimeType || (buffer.subarray(0, 4).toString() === '%PDF' ? 'application/pdf' : 'image/jpeg')
  const base64 = buffer.toString('base64')

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: EXTRACTION_PROMPT }, { inlineData: { mimeType: effectiveMime, data: base64 } }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  }

  let lastError: Error | null = null

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      )

      if (!response.ok) {
        const detail = await response.text()
        // 404 means this model name isn't available for this key/region —
        // try the next one in the fallback chain instead of failing outright.
        if (response.status === 404) {
          lastError = new Error(`Model "${model}" unavailable (${response.status}): ${detail.slice(0, 200)}`)
          continue
        }
        throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 500)}`)
      }

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')

      if (!text) throw new Error('Gemini returned no extraction text')
      return parseExtraction(text)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error')
    }
  }

  throw lastError || new Error('All Gemini model attempts failed')
}

function parseExtraction(text: string): ExtractionResult {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned) as ExtractionResult
  parsed.rawText = text
  if (!parsed.items) parsed.items = []
  if (!parsed.flags) parsed.flags = {}
  parsed.items = parsed.items.map((item) => ({
    ...item,
    // Defensive normalization: if the model returns a category outside our
    // fixed list (hallucination, casing mismatch, etc.), fall back to
    // "General" rather than letting an unrecognized value into the DB.
    category: item.category && (PRODUCT_CATEGORIES as readonly string[]).includes(item.category)
      ? item.category
      : 'General',
    flags: item.flags || {},
  }))
  return parsed
}

function extractionError(error: string): ExtractionResult {
  return {
    invoiceNo: null,
    poNumber: null,
    invoiceDate: null,
    supplierName: null,
    baseAmount: null,
    gstAmount: null,
    cgst: null,
    sgst: null,
    igst: null,
    otherTax: null,
    totalAmount: null,
    items: [],
    flags: {},
    error,
  }
}

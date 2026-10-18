import { NextRequest, NextResponse } from 'next/server'
import { normalizeImage } from '@/lib/image'
import { parseReceiptImage } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const jpeg = await normalizeImage(buf, file.type)
    const parsed = await parseReceiptImage(jpeg)
    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    // Preserve the actionable setup hint; otherwise return a safe generic message.
    const safe = msg.includes('GEMINI_API_KEY')
      ? 'Gemini API key is missing — add GEMINI_API_KEY to your .env file.'
      : 'Could not read the receipt. Check the image and your API key, then try again.'
    return NextResponse.json({ error: safe }, { status: 500 })
  }
}

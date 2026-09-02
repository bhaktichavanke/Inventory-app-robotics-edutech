import { NextRequest, NextResponse } from 'next/server'
import { extractInvoiceData } from '@/lib/ai-extractor'
import { prisma } from '@/lib/db'
import { saveInvoiceFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    const fileType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type. Upload JPG, PNG, WebP, or PDF.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Run AI extraction directly from the in-memory buffer
    const settings = await prisma.appSettings.findUnique({ where: { id: 'settings' } }).catch(() => null)
    const apiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY
    const extracted = await extractInvoiceData(buffer, fileType, apiKey || undefined)

    // Persist the original file durably (Vercel Blob) so it can be linked to the
    // invoice once the user confirms/saves the extracted data.
    let uploaded: { url: string; fileName: string; fileType: string } | null = null
    let storageError: string | null = null
    try {
      uploaded = await saveInvoiceFile(buffer, file.name, fileType)
    } catch (uploadErr) {
      console.error('Blob upload failed:', uploadErr)
      // Extraction can still proceed even if the file couldn't be stored —
      // the user will just save the invoice without an attached document.
      // Surface this to the frontend instead of failing silently, so the
      // user knows their original document wasn't saved.
      storageError = uploadErr instanceof Error ? uploadErr.message : 'Unknown storage error'
    }

    return NextResponse.json({
      extracted,
      tempFilePath: uploaded?.url || null,
      tempFileName: uploaded?.fileName || file.name,
      fileType: fileType,
      originalName: file.name,
      storageError,
    })
  } catch (error) {
    console.error('POST /api/invoices/upload error:', error)
    return NextResponse.json({ error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
  }
}

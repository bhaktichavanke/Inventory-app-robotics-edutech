import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    return NextResponse.json(asset)
  } catch (error) {
    console.error('GET /api/assets/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { name, category, serialNumber, status, assignedTo, refundable, purchaseDate, purchasePrice, notes } = body

    const normalizedSerial = serialNumber !== undefined
      ? (serialNumber && String(serialNumber).trim() ? String(serialNumber).trim() : null)
      : undefined

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(category !== undefined && { category: category || null }),
        ...(normalizedSerial !== undefined && { serialNumber: normalizedSerial }),
        ...(status !== undefined && { status }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
        ...(refundable !== undefined && { refundable: !!refundable }),
        ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
        ...(purchasePrice !== undefined && { purchasePrice: purchasePrice ?? null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    })

    return NextResponse.json(asset)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Another asset already uses that serial number.' }, { status: 409 })
    }
    console.error('PATCH /api/assets/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.asset.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/assets/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
  }
}

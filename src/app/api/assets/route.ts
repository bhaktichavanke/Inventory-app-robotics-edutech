import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Assets are company-owned tools/equipment (multimeters, drills, etc.) —
// tracked separately from Product (consumable/resellable component stock)
// since they're individually-owned items, not something bought and used up.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { assignedTo: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.status = status
    if (category) where.category = category

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.asset.count({ where }),
    ])

    return NextResponse.json({ assets, total, page, limit })
  } catch (error) {
    console.error('GET /api/assets error:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, serialNumber, status, assignedTo, refundable, purchaseDate, purchasePrice, notes } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Asset name is required' }, { status: 400 })
    }
    const normalizedSerial = serialNumber && String(serialNumber).trim() ? String(serialNumber).trim() : null

    if (normalizedSerial) {
      const existing = await prisma.asset.findUnique({ where: { serialNumber: normalizedSerial } })
      if (existing) {
        return NextResponse.json({ error: `An asset with serial number "${normalizedSerial}" already exists` }, { status: 409 })
      }
    }

    const asset = await prisma.asset.create({
      data: {
        name: String(name).trim(),
        category: category || null,
        serialNumber: normalizedSerial,
        status: status || 'AVAILABLE_STOCK',
        assignedTo: assignedTo || null,
        refundable: !!refundable,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice ?? null,
        notes: notes || null,
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('POST /api/assets error:', error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}

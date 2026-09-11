import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const lowStock = searchParams.get('lowStock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { partNo: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (category) where.category = category
    if (status) where.status = status
    const componentStatus = searchParams.get('componentStatus') || ''
    if (componentStatus) where.componentStatus = componentStatus

    // Postgres doesn't support comparing two columns of the same row inside a
    // `where` filter without a raw query, so low-stock filtering is applied
    // in application code after fetching. Pagination is applied to the
    // filtered result rather than the raw query.
    if (lowStock) {
      const allMatching = await prisma.product.findMany({
        where,
        include: { supplier: true },
        orderBy: { partNo: 'asc' },
      })
      const filtered = allMatching.filter((p) => p.currentStock <= p.lowStockThreshold)
      const paged = filtered.slice(skip, skip + limit)
      const enriched = paged.map((p) => ({ ...p, isLowStock: true }))
      return NextResponse.json({ products: enriched, total: filtered.length, page, limit })
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { supplier: true },
        orderBy: { partNo: 'asc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    // Mark low-stock items
    const enriched = products.map((p) => ({
      ...p,
      isLowStock: p.currentStock <= p.lowStockThreshold,
    }))

    return NextResponse.json({ products: enriched, total, page, limit })
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partNo, description, category, supplierId, supplierName, unitPrice, lowStockThreshold, currentStock, status, componentStatus, assignedTo, refundable, ecommerceAllocated } = body

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }
    const normalizedPartNo = partNo && String(partNo).trim() ? String(partNo).trim() : null

    // Auto-create supplier if name provided but no ID
    let resolvedSupplierId = supplierId
    if (supplierName && !supplierId) {
      const supplier = await prisma.supplier.upsert({
        where: { name: supplierName },
        create: { name: supplierName },
        update: {},
      })
      resolvedSupplierId = supplier.id
    }

    // Check for duplicate (only meaningful when a part number was given —
    // multiple products with no part number are allowed to coexist)
    if (normalizedPartNo) {
      const existing = await prisma.product.findUnique({ where: { partNo: normalizedPartNo } })
      if (existing) {
        return NextResponse.json({ error: `Product with Part No. "${normalizedPartNo}" already exists`, existing }, { status: 409 })
      }
    }

    const product = await prisma.product.create({
      data: {
        partNo: normalizedPartNo,
        description,
        category: category || null,
        supplierId: resolvedSupplierId || null,
        unitPrice: unitPrice || 0,
        lowStockThreshold: lowStockThreshold ?? 5,
        currentStock: currentStock || 0,
        totalPurchased: currentStock || 0,
        status: status || 'ACTIVE',
        componentStatus: componentStatus || 'AVAILABLE_STOCK',
        assignedTo: assignedTo || null,
        refundable: !!refundable,
        ecommerceAllocated: ecommerceAllocated || 0,
      },
      include: { supplier: true },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}

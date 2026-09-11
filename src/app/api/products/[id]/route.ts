import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        supplier: true,
        invoiceItems: { include: { invoice: true } },
        projectComponents: { include: { project: true, invoice: true } },
        purchaseHistory: {
          include: { invoice: { include: { supplier: true } } },
          orderBy: { date: 'desc' },
        },
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ ...product, isLowStock: product.currentStock <= product.lowStockThreshold })
  } catch (error) {
    console.error('GET /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { partNo, description, category, supplierId, supplierName, unitPrice, lowStockThreshold, status, componentStatus, assignedTo, refundable, ecommerceAllocated } = body

    // Auto-create supplier if needed
    let resolvedSupplierId = supplierId
    if (supplierName && !supplierId) {
      const supplier = await prisma.supplier.upsert({
        where: { name: supplierName },
        create: { name: supplierName },
        update: {},
      })
      resolvedSupplierId = supplier.id
    }

    const normalizedPartNo = partNo !== undefined
      ? (partNo && String(partNo).trim() ? String(partNo).trim() : null)
      : undefined

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(normalizedPartNo !== undefined && { partNo: normalizedPartNo }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(resolvedSupplierId !== undefined && { supplierId: resolvedSupplierId }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold }),
        ...(status !== undefined && { status }),
        ...(componentStatus !== undefined && { componentStatus }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
        ...(refundable !== undefined && { refundable: !!refundable }),
        ...(ecommerceAllocated !== undefined && { ecommerceAllocated }),
      },
      include: { supplier: true },
    })

    return NextResponse.json(product)
  } catch (error) {
    // P2002 = unique constraint violation (duplicate part number)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Another product already uses that Part No.' }, { status: 409 })
    }
    console.error('PATCH /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    // P2003 = foreign key constraint failed — this product still has
    // purchase history, project usage, or invoice items pointing at it.
    // Deleting the product would silently orphan or corrupt those records,
    // so we block it and explain why rather than surfacing a raw DB error.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        {
          error:
            'This product has purchase or project-usage history and can\'t be deleted. ' +
            'Delete its related invoices/project components first, or set its status to "Discontinued" instead.',
        },
        { status: 409 }
      )
    }
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}

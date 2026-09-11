import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Deducts a specific quantity from a product's current stock, with a
// reason, and logs it as a StockMovement. Used when a product's status is
// changed to something that means some units are no longer available
// (Faulty, Discarded, Missing, Waived, Used in Product) — the quantity is
// asked for explicitly rather than guessed, since a status change doesn't
// by itself say how many of the units on hand are affected.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const quantity = Number(body.quantity)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'A positive quantity is required' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (quantity > product.currentStock) {
      return NextResponse.json(
        { error: `Cannot adjust more than current stock (${product.currentStock})` },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: { currentStock: { decrement: quantity } },
        include: { supplier: true },
      })
      await tx.stockMovement.create({
        data: {
          productId: id,
          type: 'ADJUSTMENT',
          quantity: -quantity,
          notes: reason || 'Manual stock adjustment',
        },
      })
      return p
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/products/[id]/adjust-stock error:', error)
    return NextResponse.json({ error: 'Failed to adjust stock' }, { status: 500 })
  }
}

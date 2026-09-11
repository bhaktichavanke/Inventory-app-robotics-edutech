import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Resolves an invoice item flagged AUTO_CREATED (its part number didn't
// match any existing product, so a new product was auto-created). Two
// actions:
//  - confirm_new: admin says this genuinely is a new product — just clears
//    the flag, no data changes needed since the product was already
//    created correctly.
//  - map_to_existing: admin says this was actually a duplicate/mismatch —
//    moves this item's stock/purchase-history effect off the wrongly
//    auto-created product and onto the correct existing product, then
//    best-effort deletes the now-empty auto-created one.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: invoiceId, itemId } = await params
  try {
    const body = await request.json()
    const action = body.action

    const item = await prisma.invoiceItem.findUnique({ where: { id: itemId } })
    if (!item || item.invoiceId !== invoiceId) {
      return NextResponse.json({ error: 'Invoice item not found' }, { status: 404 })
    }
    if (item.matchStatus !== 'AUTO_CREATED') {
      return NextResponse.json({ error: 'This item is not flagged for review' }, { status: 400 })
    }

    if (action === 'confirm_new') {
      const updated = await prisma.invoiceItem.update({
        where: { id: itemId },
        data: { matchStatus: 'CONFIRMED_NEW' },
        include: { product: true },
      })
      return NextResponse.json(updated)
    }

    if (action === 'map_to_existing') {
      const targetProductId = body.productId
      if (!targetProductId) {
        return NextResponse.json({ error: 'productId is required' }, { status: 400 })
      }
      if (targetProductId === item.productId) {
        return NextResponse.json({ error: 'Item is already on that product' }, { status: 400 })
      }

      const targetProduct = await prisma.product.findUnique({ where: { id: targetProductId } })
      if (!targetProduct) return NextResponse.json({ error: 'Target product not found' }, { status: 404 })

      const wrongProductId = item.productId
      const quantity = item.quantity

      const updatedItem = await prisma.$transaction(async (tx) => {
        if (wrongProductId) {
          // Reverse the effect on the wrongly auto-created product.
          await tx.product.update({
            where: { id: wrongProductId },
            data: {
              currentStock: { decrement: quantity },
              totalPurchased: { decrement: quantity },
            },
          })
          await tx.purchaseHistory.deleteMany({ where: { invoiceId, productId: wrongProductId } })
          await tx.stockMovement.deleteMany({ where: { referenceId: invoiceId, productId: wrongProductId } })
        }

        // Apply it to the correct product instead.
        await tx.product.update({
          where: { id: targetProductId },
          data: {
            currentStock: { increment: quantity },
            totalPurchased: { increment: quantity },
            lastPurchaseDate: new Date(),
          },
        })
        await tx.purchaseHistory.create({
          data: {
            productId: targetProductId,
            invoiceId,
            quantity,
            unitPrice: item.unitPrice,
            date: new Date(),
          },
        })
        await tx.stockMovement.create({
          data: {
            productId: targetProductId,
            type: 'PURCHASE',
            quantity,
            referenceId: invoiceId,
            referenceType: 'INVOICE',
            notes: 'Mapped from a flagged/unmatched invoice item',
          },
        })

        const updated = await tx.invoiceItem.update({
          where: { id: itemId },
          data: {
            productId: targetProductId,
            partNo: targetProduct.partNo,
            matchStatus: 'MATCHED',
          },
          include: { product: true },
        })

        // Best-effort cleanup: if the wrongly auto-created product has no
        // other history left, remove it — it only ever existed because of
        // this one mis-matched item. Never blocks the request if it fails
        // (e.g. it picked up other references in the meantime).
        if (wrongProductId) {
          try {
            await tx.product.delete({ where: { id: wrongProductId } })
          } catch {
            // Left in place — has other references, which is fine.
          }
        }

        return updated
      })

      return NextResponse.json(updatedItem)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('PATCH /api/invoices/[id]/items/[itemId]/resolve error:', error)
    return NextResponse.json({ error: 'Failed to resolve invoice item' }, { status: 500 })
  }
}

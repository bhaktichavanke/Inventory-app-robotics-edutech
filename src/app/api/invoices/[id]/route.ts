import { prisma } from '@/lib/db'
import { deleteInvoiceFile } from '@/lib/storage'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true } },
        purchaseHistory: { include: { product: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const allowed = ['poNumber', 'invoiceDate', 'baseAmount', 'gstAmount', 'cgst', 'sgst', 'igst', 'otherTax', 'totalAmount', 'receivedDate', 'status', 'notes', 'accountNumber', 'accountName']

    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'invoiceDate' || key === 'receivedDate') {
          updateData[key] = body[key] ? new Date(body[key]) : null
        } else {
          updateData[key] = body[key]
        }
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { supplier: true, items: { include: { product: true } } },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Get invoice items to reverse stock
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      // Reverse stock updates
      for (const item of invoice.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { decrement: item.quantity },
              totalPurchased: { decrement: item.quantity },
            },
          })
        }
      }
      await tx.purchaseHistory.deleteMany({ where: { invoiceId: id } })
      await tx.stockMovement.deleteMany({ where: { referenceId: id } })
      await tx.invoice.delete({ where: { id } })
    })

    // Best-effort cleanup of the stored document — never blocks the response.
    await deleteInvoiceFile(invoice.filePath)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}

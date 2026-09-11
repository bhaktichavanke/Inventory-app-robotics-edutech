import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({ invoices, total, page, limit })
  } catch (error) {
    console.error('GET /api/invoices error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      invoiceNo, poNumber, supplierId, supplierName, invoiceDate,
      baseAmount, gstAmount, cgst, sgst, igst, otherTax, totalAmount,
      receivedDate, status, notes, items, filePath, fileType, fileName,
      accountNumber, accountName,
    } = body

    if (!invoiceNo) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Check for duplicate invoice number
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } })
    if (existing) {
      return NextResponse.json({ error: `Invoice "${invoiceNo}" already exists` }, { status: 409 })
    }

    // Auto-create supplier if name provided
    let resolvedSupplierId = supplierId
    if (supplierName && !supplierId) {
      const supplier = await prisma.supplier.upsert({
        where: { name: supplierName },
        create: { name: supplierName },
        update: {},
      })
      resolvedSupplierId = supplier.id
    }

    // Create invoice + items in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNo,
          poNumber: poNumber || null,
          supplierId: resolvedSupplierId || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          baseAmount: baseAmount || 0,
          gstAmount: gstAmount || 0,
          cgst: cgst || 0,
          sgst: sgst || 0,
          igst: igst || 0,
          otherTax: otherTax || 0,
          totalAmount: totalAmount || 0,
          receivedDate: receivedDate ? new Date(receivedDate) : null,
          status: status || 'NOT_RECEIVED',
          filePath: filePath || null,
          fileType: fileType || null,
          fileName: fileName || null,
          notes: notes || null,
          accountNumber: accountNumber || null,
          accountName: accountName || null,
        },
      })

      // Process each item: upsert product, create invoice item, update stock
      for (const item of items) {
        const { partNo, description, category, quantity, unitPrice, baseAmount: itemBase, gstAmount: itemGst, totalAmount: itemTotal } = item
        // A part/model number is genuinely optional — many purchased items
        // (raw materials, generic hardware) never had one on the invoice.
        // Only attempt to match/dedupe against an existing product when one
        // was actually provided; otherwise always create a fresh product
        // record rather than querying `findUnique` with an empty value
        // (which Prisma rejects) or accidentally colliding two unrelated
        // blank-part-number items together.
        const normalizedPartNo = partNo && String(partNo).trim() ? String(partNo).trim() : null

        // Find or create product
        let product = normalizedPartNo
          ? await tx.product.findUnique({ where: { partNo: normalizedPartNo } })
          : null

        // No existing product matched (either no part number was given, or
        // the given one doesn't exist yet) — a new product gets created so
        // stock still tracks correctly right away, but the item is flagged
        // AUTO_CREATED so an admin can review it: confirm it's genuinely
        // new, or map it onto an existing product if this was actually a
        // duplicate (misspelling, missing part number, etc).
        const isNewMatch = !product
        if (!product) {
          product = await tx.product.create({
            data: {
              partNo: normalizedPartNo,
              description,
              category: category || null,
              supplierId: resolvedSupplierId || null,
              unitPrice: unitPrice || 0,
              currentStock: quantity,
              totalPurchased: quantity,
              totalUsed: 0,
              lastPurchaseDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            },
          })
        } else {
          // Update existing product stock
          await tx.product.update({
            where: { id: product.id },
            data: {
              currentStock: { increment: quantity },
              totalPurchased: { increment: quantity },
              unitPrice: unitPrice || product.unitPrice,
              // Only backfill category if the product doesn't already have one —
              // don't let a re-purchase silently overwrite a manually-corrected category.
              category: product.category || category || product.category,
              lastPurchaseDate: invoiceDate ? new Date(invoiceDate) : new Date(),
              supplierId: resolvedSupplierId || product.supplierId,
            },
          })
        }

        // Create invoice item
        await tx.invoiceItem.create({
          data: {
            invoiceId: createdInvoice.id,
            productId: product.id,
            partNo: normalizedPartNo,
            description,
            quantity,
            unitPrice: unitPrice || 0,
            baseAmount: itemBase || 0,
            gstAmount: itemGst || 0,
            totalAmount: itemTotal || 0,
            matchStatus: isNewMatch ? 'AUTO_CREATED' : 'MATCHED',
          },
        })

        // Record purchase history
        await tx.purchaseHistory.create({
          data: {
            productId: product.id,
            invoiceId: createdInvoice.id,
            quantity,
            unitPrice: unitPrice || 0,
            date: invoiceDate ? new Date(invoiceDate) : new Date(),
          },
        })

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'PURCHASE',
            quantity,
            referenceId: createdInvoice.id,
            referenceType: 'INVOICE',
            notes: `Purchase via ${invoiceNo}`,
          },
        })
      }

      return createdInvoice
    })

    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { supplier: true, items: { include: { product: true } } },
    })

    return NextResponse.json(fullInvoice, { status: 201 })
  } catch (error) {
    console.error('POST /api/invoices error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}

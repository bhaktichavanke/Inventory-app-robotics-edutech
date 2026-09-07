import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Add component to project (with stock deduction)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  try {
    const body = await request.json()
    const { productId, invoiceId, subTaskId, quantityUsed, dateUsed, notes } = body

    if (!productId || !quantityUsed || quantityUsed <= 0) {
      return NextResponse.json({ error: 'productId and quantityUsed > 0 are required' }, { status: 400 })
    }

    // Check stock availability
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    if (product.currentStock < quantityUsed) {
      return NextResponse.json({
        error: `Insufficient stock. Available: ${product.currentStock}, Requested: ${quantityUsed}`,
        currentStock: product.currentStock,
      }, { status: 400 })
    }

    if (subTaskId) {
      const subTask = await prisma.projectSubTask.findUnique({ where: { id: subTaskId } })
      if (!subTask || subTask.projectId !== projectId) {
        return NextResponse.json({ error: 'Sub-task not found on this project' }, { status: 404 })
      }
    }

    const component = await prisma.$transaction(async (tx) => {
      const comp = await tx.projectComponent.create({
        data: {
          projectId,
          subTaskId: subTaskId || null,
          productId,
          invoiceId: invoiceId || null,
          quantityUsed,
          dateUsed: dateUsed ? new Date(dateUsed) : new Date(),
          notes: notes || null,
        },
        include: { product: true, invoice: true },
      })

      // Deduct from stock
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: { decrement: quantityUsed },
          totalUsed: { increment: quantityUsed },
        },
      })

      // Record movement
      await tx.stockMovement.create({
        data: {
          productId,
          type: 'USAGE',
          quantity: -quantityUsed,
          referenceId: projectId,
          referenceType: 'PROJECT',
          notes: `Used in project component`,
        },
      })

      return comp
    })

    return NextResponse.json(component, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add component' }, { status: 500 })
  }
}

// Remove component from project (restore stock)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  try {
    const { searchParams } = new URL(request.url)
    const componentId = searchParams.get('componentId')
    if (!componentId) return NextResponse.json({ error: 'componentId required' }, { status: 400 })

    const component = await prisma.projectComponent.findUnique({ where: { id: componentId } })
    if (!component || component.projectId !== projectId) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectComponent.delete({ where: { id: componentId } })
      await tx.product.update({
        where: { id: component.productId },
        data: {
          currentStock: { increment: component.quantityUsed },
          totalUsed: { decrement: component.quantityUsed },
        },
      })
      await tx.stockMovement.create({
        data: {
          productId: component.productId,
          type: 'ADJUSTMENT',
          quantity: component.quantityUsed,
          referenceId: projectId,
          referenceType: 'PROJECT',
          notes: 'Component removed — stock restored',
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove component' }, { status: 500 })
  }
}

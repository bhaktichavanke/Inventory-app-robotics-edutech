import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subTaskId: string }> }
) {
  const { subTaskId } = await params
  try {
    const body = await request.json()
    const subTask = await prisma.projectSubTask.update({
      where: { id: subTaskId },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
    })
    return NextResponse.json(subTask)
  } catch (error) {
    console.error('PATCH /api/projects/[id]/subtasks/[subTaskId] error:', error)
    return NextResponse.json({ error: 'Failed to update sub-task' }, { status: 500 })
  }
}

// Deleting a sub-task must first reverse the stock deducted by any
// components attached to it — otherwise that stock would be silently lost
// (the DB cascade would delete the usage records without restoring stock).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; subTaskId: string }> }
) {
  const { subTaskId } = await params
  try {
    const subTask = await prisma.projectSubTask.findUnique({
      where: { id: subTaskId },
      include: { components: true },
    })
    if (!subTask) return NextResponse.json({ error: 'Sub-task not found' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      for (const comp of subTask.components) {
        await tx.product.update({
          where: { id: comp.productId },
          data: {
            currentStock: { increment: comp.quantityUsed },
            totalUsed: { decrement: comp.quantityUsed },
          },
        })
        await tx.stockMovement.create({
          data: {
            productId: comp.productId,
            type: 'ADJUSTMENT',
            quantity: comp.quantityUsed,
            referenceId: subTask.projectId,
            referenceType: 'PROJECT',
            notes: `Sub-task "${subTask.name}" deleted — stock restored`,
          },
        })
      }
      // Cascade in schema removes the ProjectComponent rows automatically.
      await tx.projectSubTask.delete({ where: { id: subTaskId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/subtasks/[subTaskId] error:', error)
    return NextResponse.json({ error: 'Failed to delete sub-task' }, { status: 500 })
  }
}

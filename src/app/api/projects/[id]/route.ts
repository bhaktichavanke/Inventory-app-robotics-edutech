import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        components: {
          where: { subTaskId: null },
          include: { product: { include: { supplier: true } }, invoice: true },
          orderBy: { dateUsed: 'desc' },
        },
        subTasks: {
          include: {
            components: {
              include: { product: { include: { supplier: true } }, invoice: true },
              orderBy: { dateUsed: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      },
    })
    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Get components to reverse stock
    const components = await prisma.projectComponent.findMany({ where: { projectId: id } })

    await prisma.$transaction(async (tx) => {
      // Reverse stock deductions
      for (const comp of components) {
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
            referenceId: id,
            referenceType: 'PROJECT',
            notes: `Project deleted — stock reversed`,
          },
        })
      }
      await tx.project.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

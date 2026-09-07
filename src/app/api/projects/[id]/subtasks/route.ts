import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// A sub-task is a part/sub-assembly of a project (e.g. "Base", "Gripper" on
// an "Articulated Arm" project). One level deep only — a sub-task cannot
// itself have sub-tasks.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Sub-task name is required' }, { status: 400 })
    }

    const subTask = await prisma.projectSubTask.create({
      data: {
        projectId,
        name,
        notes: body.notes || null,
      },
      include: { components: { include: { product: true } } },
    })
    return NextResponse.json(subTask, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/subtasks error:', error)
    return NextResponse.json({ error: 'Failed to create sub-task' }, { status: 500 })
  }
}

import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Returns the distinct (accountName, accountNumber) pairs used on past
// invoices, so the invoice form can offer them as autocomplete suggestions
// instead of the user having to remember/retype which of their 2-3
// purchasing accounts to select each time.
export async function GET() {
  try {
    const rows = await prisma.invoice.findMany({
      where: { OR: [{ accountName: { not: null } }, { accountNumber: { not: null } }] },
      select: { accountName: true, accountNumber: true },
      distinct: ['accountName', 'accountNumber'],
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ accounts: rows.filter((r) => r.accountName || r.accountNumber) })
  } catch (error) {
    console.error('GET /api/invoices/accounts error:', error)
    return NextResponse.json({ accounts: [] })
  }
}

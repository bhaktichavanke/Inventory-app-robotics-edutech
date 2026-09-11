'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { FileText, Search, Download, Upload, CheckCircle, Clock, Eye, Sparkles, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function InvoicesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', search, statusFilter, page],
    queryFn: () =>
      fetch(`/api/invoices?search=${encodeURIComponent(search)}&status=${statusFilter}&page=${page}`).then((r) =>
        r.json()
      ),
  })

  const updateReceivedMutation = useMutation({
    mutationFn: async ({ id, receivedDate }: { id: string; receivedDate: string }) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedDate,
          status: receivedDate ? 'RECEIVED' : 'NOT_RECEIVED',
        }),
      })
      if (!res.ok) throw new Error('Failed to update invoice status')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Updated', description: 'Received date updated successfully.', type: 'success' })
    },
  })

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage invoice records, track received dates, and supplier details.</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/excel?type=invoices"
            download
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" /> Export Excel
          </a>
          <Link
            href="/invoices/upload"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all"
          >
            <Upload className="w-4 h-4" /> Upload Invoice
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Invoice No, PO Number, Supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none text-slate-700 font-medium"
          >
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="NOT_RECEIVED">Not Received</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
              <th className="p-4">Invoice No</th>
              <th className="p-4">PO Number</th>
              <th className="p-4">Supplier</th>
              <th className="p-4">Account</th>
              <th className="p-4">Invoice Date</th>
              <th className="p-4">Total Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Received Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">Loading invoices...</td>
              </tr>
            ) : data?.invoices?.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">No invoices found.</td>
              </tr>
            ) : (
              data?.invoices?.map((inv: any) => {
                const hasFlagged = inv.items?.some((it: any) => it.matchStatus === 'AUTO_CREATED')
                return (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-900 font-mono">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-blue-600 flex items-center gap-1.5">
                      {inv.invoiceNo}
                      {hasFlagged && (
                        <span title="Has unmatched items needing review">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="p-4 text-slate-600 font-mono">{inv.poNumber || '—'}</td>
                  <td className="p-4 text-slate-800 font-semibold">{inv.supplier?.name || '—'}</td>
                  <td className="p-4 text-slate-600 text-xs">
                    {inv.accountName || inv.accountNumber ? (
                      <>
                        {inv.accountName}
                        {inv.accountName && inv.accountNumber && <br />}
                        {inv.accountNumber && <span className="font-mono text-slate-400">{inv.accountNumber}</span>}
                      </>
                    ) : '—'}
                  </td>
                  <td className="p-4 text-slate-600">{formatDate(inv.invoiceDate)}</td>
                  <td className="p-4 font-extrabold text-slate-900">{formatCurrency(inv.totalAmount)}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold ${
                        inv.status === 'RECEIVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}
                    >
                      {inv.status === 'RECEIVED' ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Received
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Not Received
                        </>
                      )}
                    </span>
                  </td>
                  <td className="p-4">
                    <input
                      type="date"
                      defaultValue={inv.receivedDate ? new Date(inv.receivedDate).toISOString().split('T')[0] : ''}
                      onBlur={(e) => {
                        const val = e.target.value
                        if (val !== (inv.receivedDate ? new Date(inv.receivedDate).toISOString().split('T')[0] : '')) {
                          updateReceivedMutation.mutate({ id: inv.id, receivedDate: val })
                        }
                      }}
                      className="p-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-slate-50/60 text-slate-800 font-medium"
                    />
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="p-2 text-slate-400 hover:text-blue-600 inline-block transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

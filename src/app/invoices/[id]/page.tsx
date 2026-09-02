'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, CheckCircle, Clock, Trash2, ExternalLink, Calendar, DollarSign, Package } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetch(`/api/invoices/${id}`).then((r) => r.json()),
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to update invoice')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      toast({ title: 'Saved', description: 'Invoice updated successfully.', type: 'success' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete invoice')
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Invoice deleted and stock reversed.', type: 'info' })
      router.push('/invoices')
    },
  })

  if (isLoading) return <div className="p-8 text-gray-500">Loading invoice...</div>
  if (!inv || inv.error) return <div className="p-8 text-red-500">Invoice not found.</div>

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this invoice? Stock will be reversed.')) {
              deleteMutation.mutate()
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium"
        >
          <Trash2 className="w-4 h-4" /> Delete Invoice
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{inv.invoiceNo}</h1>
            <span
              className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold ${
                inv.status === 'RECEIVED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {inv.status === 'RECEIVED' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {inv.status === 'RECEIVED' ? 'Received' : 'Not Received'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Supplier: <span className="font-semibold text-gray-800">{inv.supplier?.name || '—'}</span> · PO Number:{' '}
            <span className="font-semibold text-gray-800">{inv.poNumber || '—'}</span>
          </p>
        </div>

        <div className="text-right bg-blue-50 p-4 rounded-xl border border-blue-100 min-w-48">
          <p className="text-xs text-blue-600 font-semibold uppercase">Total Amount</p>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(inv.totalAmount)}</p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm md:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Invoice Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">Invoice Date</p>
              <p className="font-medium text-gray-800">{formatDate(inv.invoiceDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Received Date</p>
              <input
                type="date"
                defaultValue={inv.receivedDate ? new Date(inv.receivedDate).toISOString().split('T')[0] : ''}
                onBlur={(e) => {
                  const val = e.target.value
                  updateMutation.mutate({
                    receivedDate: val || null,
                    status: val ? 'RECEIVED' : 'NOT_RECEIVED',
                  })
                }}
                className="p-1 text-xs border border-gray-300 rounded font-medium text-gray-800"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400">Base Amount</p>
              <p className="font-medium text-gray-800">{formatCurrency(inv.baseAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Taxes (CGST+SGST+IGST)</p>
              <p className="font-medium text-gray-800">
                {formatCurrency(inv.cgst + inv.sgst + inv.igst + inv.otherTax)}
              </p>
            </div>
          </div>
        </div>

        {/* Invoice File Link */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Invoice Document</h2>
            {inv.filePath ? (
              <div className="mt-4 p-4 border rounded-xl bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800 truncate max-w-40">{inv.fileName || 'Invoice File'}</p>
                    <p className="text-xs text-gray-400">{inv.fileType}</p>
                  </div>
                </div>
                <a
                  href={inv.filePath.startsWith('http') ? inv.filePath : `/api/files?path=${encodeURIComponent(inv.filePath)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white border rounded-lg hover:bg-gray-100 text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-4">No original file linked.</p>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Purchased Products ({inv.items?.length || 0})</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b">
              <th className="p-4">Part No</th>
              <th className="p-4">Description</th>
              <th className="p-4">Quantity</th>
              <th className="p-4">Unit Price</th>
              <th className="p-4">Base Amount</th>
              <th className="p-4">GST</th>
              <th className="p-4">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inv.items?.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50/60">
                <td className="p-4 font-semibold text-blue-600">
                  {item.productId ? (
                    <Link href={`/products/${item.productId}`} className="hover:underline">
                      {item.partNo || '—'}
                    </Link>
                  ) : (
                    item.partNo || '—'
                  )}
                </td>
                <td className="p-4 text-gray-800">{item.description}</td>
                <td className="p-4 font-bold text-gray-900">{item.quantity}</td>
                <td className="p-4 text-gray-700">{formatCurrency(item.unitPrice)}</td>
                <td className="p-4 text-gray-700">{formatCurrency(item.baseAmount)}</td>
                <td className="p-4 text-gray-700">{formatCurrency(item.gstAmount)}</td>
                <td className="p-4 font-bold text-gray-900">{formatCurrency(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

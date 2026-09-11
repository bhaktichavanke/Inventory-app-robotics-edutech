'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, CheckCircle, Clock, Trash2, ExternalLink, Calendar, DollarSign, Package, AlertTriangle, Search } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [resolvingItem, setResolvingItem] = useState<any>(null)
  const [productSearch, setProductSearch] = useState('')

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

  const { data: searchResults } = useQuery({
    queryKey: ['products-search-resolve', productSearch],
    queryFn: () => fetch(`/api/products?search=${encodeURIComponent(productSearch)}`).then((r) => r.json()),
    enabled: !!resolvingItem,
  })

  const resolveMutation = useMutation({
    mutationFn: async (payload: { itemId: string; action: string; productId?: string }) => {
      const res = await fetch(`/api/invoices/${id}/items/${payload.itemId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: payload.action, productId: payload.productId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resolve item')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Resolved', description: 'Invoice item updated.', type: 'success' })
      setResolvingItem(null)
      setProductSearch('')
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
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
            <div>
              <p className="text-xs text-gray-400">Purchase Account</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  defaultValue={inv.accountName || ''}
                  placeholder="Account name"
                  onBlur={(e) => {
                    if (e.target.value !== (inv.accountName || '')) {
                      updateMutation.mutate({ accountName: e.target.value || null })
                    }
                  }}
                  className="p-1 text-xs border border-gray-300 rounded font-medium text-gray-800 w-1/2"
                />
                <input
                  type="text"
                  defaultValue={inv.accountNumber || ''}
                  placeholder="Account no."
                  onBlur={(e) => {
                    if (e.target.value !== (inv.accountNumber || '')) {
                      updateMutation.mutate({ accountNumber: e.target.value || null })
                    }
                  }}
                  className="p-1 text-xs border border-gray-300 rounded font-medium text-gray-800 w-1/2 font-mono"
                />
              </div>
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
          {inv.items?.some((it: any) => it.matchStatus === 'AUTO_CREATED') && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Some items need review
            </span>
          )}
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
              <th className="p-4">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inv.items?.map((item: any) => (
              <tr key={item.id} className={item.matchStatus === 'AUTO_CREATED' ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-50/60'}>
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
                <td className="p-4">
                  {item.matchStatus === 'AUTO_CREATED' ? (
                    <button
                      onClick={() => setResolvingItem(item)}
                      className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full"
                      title="No existing product matched this item — review it"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Review
                    </button>
                  ) : (
                    <span className="text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full font-medium">Matched</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resolve flagged item modal */}
      {resolvingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Review Unmatched Item</h2>
              <p className="text-sm text-gray-500 mt-1">
                &ldquo;{resolvingItem.description}&rdquo; didn&apos;t match any existing product by part number, so a
                new product was created automatically. Confirm it&apos;s genuinely new, or map it to an existing
                product if this was a duplicate/mismatch.
              </p>
            </div>

            <button
              onClick={() => resolveMutation.mutate({ itemId: resolvingItem.id, action: 'confirm_new' })}
              disabled={resolveMutation.isPending}
              className="w-full text-left p-3 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 text-sm font-semibold text-green-800"
            >
              ✓ This is genuinely a new product — keep it as is
            </button>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">— or map it to an existing product instead —</p>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Part No or Description..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y border rounded-lg mt-2">
                {searchResults?.products
                  ?.filter((p: any) => p.id !== resolvingItem.productId)
                  .map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => resolveMutation.mutate({ itemId: resolvingItem.id, action: 'map_to_existing', productId: p.id })}
                      disabled={resolveMutation.isPending}
                      className="w-full text-left p-3 hover:bg-blue-50 text-sm flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{p.partNo ? `${p.partNo} — ` : ''}{p.description}</p>
                        <p className="text-xs text-gray-400">{p.category || 'General'} · Current Stock: {p.currentStock}</p>
                      </div>
                    </button>
                  ))}
                {productSearch && searchResults?.products?.length === 0 && (
                  <p className="p-3 text-xs text-gray-400 text-center">No matching products found.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setResolvingItem(null); setProductSearch('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

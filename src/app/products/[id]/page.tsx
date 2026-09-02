'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, History, FolderKanban, AlertTriangle, FileText, CheckCircle, Clock, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>(null)

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetch(`/api/products/${id}`).then((r) => r.json()),
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update product')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Saved', description: 'Product updated.', type: 'success' })
      setEditing(false)
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete product')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Deleted', description: 'Product removed from catalog.', type: 'success' })
      router.push('/products')
    },
    onError: (err: Error) => toast({ title: 'Cannot Delete', description: err.message, type: 'error' }),
  })

  const startEditing = () => {
    setEditForm({
      partNo: product.partNo || '',
      description: product.description,
      category: product.category || '',
      supplierName: product.supplier?.name || '',
      unitPrice: product.unitPrice,
      lowStockThreshold: product.lowStockThreshold,
      status: product.status,
    })
    setEditing(true)
  }

  const handleDelete = () => {
    if (confirm(`Delete "${product.partNo || product.description}"? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading product traceability data...</div>
  if (!product || product.error) return <div className="p-8 text-red-500">Product not found.</div>

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Product Master
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Edit Form (inline) */}
      {editing && editForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Product</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Part No. (optional)</label>
              <input
                type="text"
                value={editForm.partNo}
                onChange={(e) => setEditForm({ ...editForm, partNo: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="">General</option>
                {PRODUCT_CATEGORIES.filter((c) => c !== 'General').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={editForm.supplierName}
                onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Price (₹)</label>
              <input
                type="number"
                value={editForm.unitPrice}
                onChange={(e) => setEditForm({ ...editForm, unitPrice: Number(e.target.value) })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Low Stock Limit</label>
              <input
                type="number"
                value={editForm.lowStockThreshold}
                onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: Number(e.target.value) })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="ACTIVE">Active</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={() => updateMutation.mutate(editForm)}
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Main Overview Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {product.partNo || <span className="text-gray-400 italic font-normal">No part number</span>}
            </h1>
            <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
              {product.category || 'General'}
            </span>
            {product.isLowStock && (
              <span className="bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
              </span>
            )}
          </div>
          <p className="text-base font-medium text-gray-700 mt-1">{product.description}</p>
          <p className="text-sm text-gray-400 mt-1">
            Supplier: <span className="text-gray-800 font-medium">{product.supplier?.name || '—'}</span> · Unit Price:{' '}
            <span className="text-gray-800 font-medium">{formatCurrency(product.unitPrice)}</span>
          </p>
        </div>

        {/* Real-time Formula Card */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center min-w-64">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Stock Formula Breakdown</p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Total Purchased: <span className="font-bold text-gray-900">{product.totalPurchased}</span></p>
            <p>− Total Used in Projects: <span className="font-bold text-red-600">{product.totalUsed}</span></p>
            <div className="border-t pt-1 font-bold text-base text-gray-900">
              = Current Stock: <span className={product.isLowStock ? 'text-red-600 font-black' : 'text-green-600'}>{product.currentStock}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Traceability Section 1: Purchase History (Invoices & POs) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Purchase History & Source Invoices</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b">
              <th className="p-4">Invoice No</th>
              <th className="p-4">PO Number</th>
              <th className="p-4">Supplier</th>
              <th className="p-4">Qty Purchased</th>
              <th className="p-4">Unit Cost</th>
              <th className="p-4">Purchase Date</th>
              <th className="p-4">Invoice Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {product.purchaseHistory?.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">No purchase records linked yet.</td>
              </tr>
            ) : (
              product.purchaseHistory?.map((ph: any) => (
                <tr key={ph.id} className="hover:bg-gray-50/60">
                  <td className="p-4 font-semibold text-blue-600">
                    <Link href={`/invoices/${ph.invoiceId}`} className="hover:underline">
                      {ph.invoice?.invoiceNo}
                    </Link>
                  </td>
                  <td className="p-4 text-gray-600">{ph.invoice?.poNumber || '—'}</td>
                  <td className="p-4 text-gray-800">{ph.invoice?.supplier?.name || '—'}</td>
                  <td className="p-4 font-bold text-gray-900">{ph.quantity}</td>
                  <td className="p-4 text-gray-700">{formatCurrency(ph.unitPrice)}</td>
                  <td className="p-4 text-gray-600">{formatDate(ph.date)}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      ph.invoice?.status === 'RECEIVED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ph.invoice?.status === 'RECEIVED' ? 'Received' : 'Not Received'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Traceability Section 2: Project Usage History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">Project Component Usage</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b">
              <th className="p-4">Project Name</th>
              <th className="p-4">Qty Used</th>
              <th className="p-4">Sourced Invoice</th>
              <th className="p-4">Date Used</th>
              <th className="p-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {product.projectComponents?.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">No project component usage records yet.</td>
              </tr>
            ) : (
              product.projectComponents?.map((pc: any) => (
                <tr key={pc.id} className="hover:bg-gray-50/60">
                  <td className="p-4 font-semibold text-purple-700">
                    <Link href={`/projects/${pc.projectId}`} className="hover:underline">
                      {pc.project?.name}
                    </Link>
                  </td>
                  <td className="p-4 font-bold text-gray-900">{pc.quantityUsed}</td>
                  <td className="p-4 text-blue-600">
                    {pc.invoice ? (
                      <Link href={`/invoices/${pc.invoiceId}`} className="hover:underline">
                        {pc.invoice.invoiceNo}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-4 text-gray-600">{formatDate(pc.dateUsed)}</td>
                  <td className="p-4 text-gray-500 text-xs">{pc.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

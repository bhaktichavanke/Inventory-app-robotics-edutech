'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Package, Search, Download, Plus, AlertTriangle, Eye, Filter, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import { COMPONENT_STATUS_OPTIONS, STATUS_BADGE_STYLE, STOCK_REDUCING_STATUSES } from '@/lib/componentStatus'

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)

  const [newProduct, setNewProduct] = useState({
    partNo: '',
    description: '',
    category: '',
    supplierName: '',
    unitPrice: 0,
    currentStock: 0,
    lowStockThreshold: 5,
    assignedTo: '',
    refundable: false,
    ecommerceAllocated: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, categoryFilter, statusFilter],
    queryFn: () =>
      fetch(`/api/products?search=${encodeURIComponent(search)}&category=${categoryFilter}&status=${statusFilter}`).then((r) =>
        r.json()
      ),
  })

  const createProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create product')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Success', description: 'Product created successfully.', type: 'success' })
      setShowAddModal(false)
      setNewProduct({ partNo: '', description: '', category: '', supplierName: '', unitPrice: 0, currentStock: 0, lowStockThreshold: 5, assignedTo: '', refundable: false, ecommerceAllocated: 0 })
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, type: 'error' })
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update product')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Saved', description: 'Product updated successfully.', type: 'success' })
      setEditingProduct(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, type: 'error' })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete product')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Deleted', description: 'Product removed from catalog.', type: 'success' })
    },
    onError: (err: Error) => {
      toast({ title: 'Cannot Delete', description: err.message, type: 'error' })
    },
  })

  const handleDelete = (p: any) => {
    if (confirm(`Delete "${p.partNo || p.description}"? This cannot be undone.`)) {
      deleteProductMutation.mutate(p.id)
    }
  }

  // Some status changes (Faulty, Discarded, Missing, Waived, Used in
  // Product) mean some units are no longer available — asks how many
  // rather than guessing, then adjusts stock and status together.
  const handleStatusChange = async (product: any, newStatus: string) => {
    if (STOCK_REDUCING_STATUSES.includes(newStatus) && !STOCK_REDUCING_STATUSES.includes(product.componentStatus)) {
      const input = prompt(
        `How many units of "${product.partNo || product.description}" are now ${COMPONENT_STATUS_OPTIONS.find((s) => s.value === newStatus)?.label}? (Current stock: ${product.currentStock})`,
        String(product.currentStock)
      )
      if (input === null) return // cancelled
      const qty = Number(input)
      if (!qty || qty <= 0 || qty > product.currentStock) {
        toast({ title: 'Invalid quantity', description: `Enter a number between 1 and ${product.currentStock}.`, type: 'error' })
        return
      }
      try {
        const res = await fetch(`/api/products/${product.id}/adjust-stock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: qty, reason: `Marked ${newStatus}` }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to adjust stock')
      } catch (err) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to adjust stock', type: 'error' })
        return
      }
    }
    updateProductMutation.mutate({ id: product.id, componentStatus: newStatus })
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Product Master</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Continuous catalog of all historical and newly added products.</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/excel?type=products"
            download
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" /> Export Master Excel
          </a>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Part No, Item Description, Category, Supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-slate-900 font-medium"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none text-slate-700 font-medium"
          >
            <option value="">All Categories</option>
            <option value="Motors">Motors</option>
            <option value="Microcontrollers">Microcontrollers</option>
            <option value="Drivers">Drivers</option>
            <option value="Sensors">Sensors</option>
            <option value="Power">Power</option>
            <option value="Passive">Passive</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none text-slate-700 font-medium"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
              <th className="p-4">Part No.</th>
              <th className="p-4">Item Description</th>
              <th className="p-4">Category</th>
              <th className="p-4">Status</th>
              <th className="p-4">Supplier</th>
              <th className="p-4">Current Stock</th>
              <th className="p-4">Available for Use</th>
              <th className="p-4">Total Purchased</th>
              <th className="p-4">Total Used</th>
              <th className="p-4">Unit Price</th>
              <th className="p-4">Last Purchase Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-400">Loading product master...</td>
              </tr>
            ) : data?.products?.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-400">No products found.</td>
              </tr>
            ) : (
              data?.products?.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-blue-600 font-mono">
                    <Link href={`/products/${p.id}`} className="hover:underline">
                      {p.partNo || <span className="text-slate-400 font-sans font-normal italic">no part no.</span>}
                    </Link>
                  </td>
                  <td className="p-4 font-semibold text-slate-900">{p.description}</td>
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                      {p.category || 'General'}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={p.componentStatus || 'AVAILABLE_STOCK'}
                      onChange={(e) => handleStatusChange(p, e.target.value)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_BADGE_STYLE[p.componentStatus] || 'bg-green-100 text-green-700'}`}
                    >
                      {COMPONENT_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {p.assignedTo && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        → {p.assignedTo}{p.refundable ? ' (borrowed)' : ''}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{p.supplier?.name || '—'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={p.isLowStock ? 'text-amber-600 font-extrabold' : 'text-slate-900'}>
                        {p.currentStock}
                      </span>
                      {p.isLowStock && (
                        <span title="Low stock warning!">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-slate-700 font-semibold">
                    {p.ecommerceAllocated > 0 ? (
                      <span title={`${p.currentStock} total − ${p.ecommerceAllocated} allocated to sell`}>
                        {p.currentStock - p.ecommerceAllocated}
                      </span>
                    ) : (
                      p.currentStock
                    )}
                  </td>
                  <td className="p-4 text-slate-600">{p.totalPurchased}</td>
                  <td className="p-4 text-slate-600">{p.totalUsed}</td>
                  <td className="p-4 text-slate-800 font-semibold">{formatCurrency(p.unitPrice)}</td>
                  <td className="p-4 text-slate-500 text-xs">{formatDate(p.lastPurchaseDate)}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <Link href={`/products/${p.id}`} className="p-2 text-slate-400 hover:text-blue-600 inline-block transition-colors" title="View">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => setEditingProduct({ id: p.id, partNo: p.partNo || '', description: p.description, category: p.category || '', supplierName: p.supplier?.name || '', unitPrice: p.unitPrice, lowStockThreshold: p.lowStockThreshold, status: p.status, assignedTo: p.assignedTo || '', refundable: p.refundable, ecommerceAllocated: p.ecommerceAllocated || 0 })}
                      className="p-2 text-slate-400 hover:text-blue-600 inline-block transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-2 text-slate-400 hover:text-red-600 inline-block transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
            <h2 className="text-xl font-extrabold text-slate-900">Add New Product</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Part No. <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. MTR-002 — leave blank if the item has no part number"
                  value={newProduct.partNo}
                  onChange={(e) => setNewProduct({ ...newProduct, partNo: e.target.value })}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Servo Motor Micro SG90"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">General</option>
                    {PRODUCT_CATEGORIES.filter((c) => c !== 'General').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    placeholder="Supplier Name"
                    value={newProduct.supplierName}
                    onChange={(e) => setNewProduct({ ...newProduct, supplierName: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={newProduct.unitPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, unitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={newProduct.currentStock}
                    onChange={(e) => setNewProduct({ ...newProduct, currentStock: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Low Stock Limit</label>
                  <input
                    type="number"
                    value={newProduct.lowStockThreshold}
                    onChange={(e) => setNewProduct({ ...newProduct, lowStockThreshold: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned To <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. R&D Team"
                    value={newProduct.assignedTo}
                    onChange={(e) => setNewProduct({ ...newProduct, assignedTo: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allocated to Sell <span className="font-normal text-slate-400">(e.g. Shopify)</span></label>
                  <input
                    type="number"
                    value={newProduct.ecommerceAllocated}
                    onChange={(e) => setNewProduct({ ...newProduct, ecommerceAllocated: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={newProduct.refundable}
                  onChange={(e) => setNewProduct({ ...newProduct, refundable: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                Borrowed / expected back (refundable)
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => createProductMutation.mutate(newProduct)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
            <h2 className="text-xl font-extrabold text-slate-900">Edit Product</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Part No. <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Leave blank if the item has no part number"
                  value={editingProduct.partNo}
                  onChange={(e) => setEditingProduct({ ...editingProduct, partNo: e.target.value })}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Description *</label>
                <input
                  type="text"
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">General</option>
                    {PRODUCT_CATEGORIES.filter((c) => c !== 'General').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={editingProduct.supplierName}
                    onChange={(e) => setEditingProduct({ ...editingProduct, supplierName: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={editingProduct.unitPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Low Stock Limit</label>
                  <input
                    type="number"
                    value={editingProduct.lowStockThreshold}
                    onChange={(e) => setEditingProduct({ ...editingProduct, lowStockThreshold: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISCONTINUED">Discontinued</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned To <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. R&D Team"
                    value={editingProduct.assignedTo}
                    onChange={(e) => setEditingProduct({ ...editingProduct, assignedTo: e.target.value })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allocated to Sell <span className="font-normal text-slate-400">(e.g. Shopify)</span></label>
                  <input
                    type="number"
                    value={editingProduct.ecommerceAllocated}
                    onChange={(e) => setEditingProduct({ ...editingProduct, ecommerceAllocated: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={!!editingProduct.refundable}
                  onChange={(e) => setEditingProduct({ ...editingProduct, refundable: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                Borrowed / expected back (refundable)
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <button onClick={() => setEditingProduct(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => updateProductMutation.mutate(editingProduct)}
                disabled={updateProductMutation.isPending}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

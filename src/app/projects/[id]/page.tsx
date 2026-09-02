'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FolderKanban, Plus, Trash2, Search, CheckCircle, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  const [showAddComponentModal, setShowAddComponentModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [quantityUsed, setQuantityUsed] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')

  // Fetch Project Detail
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  })

  // Search Products for Component Selection
  const { data: productsData } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: () => fetch(`/api/products?search=${encodeURIComponent(productSearch)}`).then((r) => r.json()),
    enabled: showAddComponentModal,
  })

  // Add Component Mutation (deducts stock)
  const addComponentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/projects/${id}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add component')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Component Added', description: 'Stock automatically deducted from inventory.', type: 'success' })
      setShowAddComponentModal(false)
      setSelectedProduct(null)
      setSelectedInvoiceId('')
      setQuantityUsed(1)
      setNotes('')
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, type: 'error' })
    },
  })

  // Remove Component Mutation (restores stock)
  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      const res = await fetch(`/api/projects/${id}/components?componentId=${componentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove component')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Component Removed', description: 'Stock restored to inventory.', type: 'info' })
    },
  })

  if (isLoading) return <div className="p-8 text-gray-500">Loading project detail...</div>
  if (!project || project.error) return <div className="p-8 text-red-500">Project not found.</div>

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </button>
      </div>

      {/* Main Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className="bg-purple-100 text-purple-800 text-xs px-3 py-1 rounded-full font-semibold">
              {project.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{project.description || 'No description provided.'}</p>
        </div>

        <button
          onClick={() => setShowAddComponentModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Component to Project
        </button>
      </div>

      {/* Components Table matching prompt format */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Project Components ({project.components?.length || 0})
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b">
              <th className="p-4">Component Description</th>
              <th className="p-4">Part No.</th>
              <th className="p-4 text-center">Qty Used</th>
              <th className="p-4">Invoice No.</th>
              <th className="p-4">Date Used</th>
              <th className="p-4">Notes</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {project.components?.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  No components assigned to this project yet. Click &ldquo;Add Component&rdquo; above.
                </td>
              </tr>
            ) : (
              project.components?.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="p-4 font-medium text-gray-900">{c.product?.description}</td>
                  <td className="p-4 font-semibold text-blue-600">
                    <Link href={`/products/${c.productId}`} className="hover:underline">
                      {c.product?.partNo || '—'}
                    </Link>
                  </td>
                  <td className="p-4 font-bold text-center text-gray-900">{c.quantityUsed}</td>
                  <td className="p-4 text-blue-600 font-medium">
                    {c.invoice ? (
                      <Link href={`/invoices/${c.invoiceId}`} className="hover:underline">
                        {c.invoice.invoiceNo}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-4 text-gray-600 text-xs">{formatDate(c.dateUsed)}</td>
                  <td className="p-4 text-gray-500 text-xs">{c.notes || '—'}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => removeComponentMutation.mutate(c.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      title="Remove component and restore inventory stock"
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

      {/* Add Component Modal */}
      {showAddComponentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Add Component from Inventory</h2>

            {/* Step 1: Select Product */}
            {!selectedProduct ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-700">Search Product by Part No or Description</label>
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

                <div className="max-h-60 overflow-y-auto divide-y border rounded-lg">
                  {productsData?.products?.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{p.partNo ? `${p.partNo} — ` : ''}{p.description}</p>
                        <p className="text-xs text-gray-400">{p.category || 'General'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold ${p.currentStock <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          Available Stock: {p.currentStock}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Step 2: Configure Quantity & Select Invoice */
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-bold text-blue-900">{selectedProduct.partNo ? `${selectedProduct.partNo} — ` : ''}{selectedProduct.description}</p>
                    <p className="text-xs text-blue-700">Available Stock: {selectedProduct.currentStock} units</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-xs text-blue-600 hover:underline font-semibold">
                    Change Product
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Used *</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedProduct.currentStock}
                    value={quantityUsed}
                    onChange={(e) => setQuantityUsed(Number(e.target.value))}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg font-bold"
                  />
                  {quantityUsed > selectedProduct.currentStock && (
                    <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ Cannot exceed available stock ({selectedProduct.currentStock})</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Source Invoice No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-1024"
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Four drive motors for chassis"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowAddComponentModal(false)
                  setSelectedProduct(null)
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              {selectedProduct && (
                <button
                  onClick={() =>
                    addComponentMutation.mutate({
                      productId: selectedProduct.id,
                      quantityUsed,
                      invoiceId: selectedInvoiceId || undefined,
                      notes,
                    })
                  }
                  disabled={quantityUsed <= 0 || quantityUsed > selectedProduct.currentStock}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Add & Deduct Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

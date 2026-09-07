'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Search, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

// A "sub-task" here means a part/sub-assembly of the project (e.g. an
// "Articulated Arm" project might have sub-tasks "Base", "Joint 1",
// "Gripper"), each consuming its own set of products. Components can also
// be added directly to the project with no sub-task, for simpler projects
// that don't need this breakdown.

function ComponentsTable({
  components,
  onRemove,
}: {
  components: any[]
  onRemove: (componentId: string) => void
}) {
  if (!components || components.length === 0) {
    return <div className="p-6 text-center text-gray-400 text-sm">No products used here yet.</div>
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="bg-gray-50 text-gray-500 text-xs border-b">
          <th className="p-3">Product</th>
          <th className="p-3">Part No.</th>
          <th className="p-3 text-center">Qty Used</th>
          <th className="p-3">Invoice No.</th>
          <th className="p-3">Date Used</th>
          <th className="p-3">Notes</th>
          <th className="p-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {components.map((c: any) => (
          <tr key={c.id} className="hover:bg-gray-50/60">
            <td className="p-3 font-medium text-gray-900">{c.product?.description}</td>
            <td className="p-3 font-semibold text-blue-600">
              <Link href={`/products/${c.productId}`} className="hover:underline">
                {c.product?.partNo || '—'}
              </Link>
            </td>
            <td className="p-3 font-bold text-center text-gray-900">{c.quantityUsed}</td>
            <td className="p-3 text-blue-600 font-medium">
              {c.invoice ? (
                <Link href={`/invoices/${c.invoiceId}`} className="hover:underline">
                  {c.invoice.invoiceNo}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className="p-3 text-gray-600 text-xs">{formatDate(c.dateUsed)}</td>
            <td className="p-3 text-gray-500 text-xs">{c.notes || '—'}</td>
            <td className="p-3 text-right">
              <button
                onClick={() => onRemove(c.id)}
                className="p-1.5 text-gray-400 hover:text-red-600"
                title="Remove and restore inventory stock"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // undefined = modal closed; null = adding a general (no sub-task)
  // component; a string = adding into that sub-task
  const [addComponentTarget, setAddComponentTarget] = useState<string | null | undefined>(undefined)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [quantityUsed, setQuantityUsed] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')

  const [expandedSubTasks, setExpandedSubTasks] = useState<Record<string, boolean>>({})
  const [newSubTaskName, setNewSubTaskName] = useState('')
  const [showAddSubTask, setShowAddSubTask] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: () => fetch(`/api/products?search=${encodeURIComponent(productSearch)}`).then((r) => r.json()),
    enabled: addComponentTarget !== undefined,
  })

  const closeAddComponentModal = () => {
    setAddComponentTarget(undefined)
    setSelectedProduct(null)
    setSelectedInvoiceId('')
    setQuantityUsed(1)
    setNotes('')
    setProductSearch('')
  }

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
      toast({ title: 'Product Added', description: 'Stock automatically deducted from inventory.', type: 'success' })
      closeAddComponentModal()
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
  })

  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      const res = await fetch(`/api/projects/${id}/components?componentId=${componentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove component')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast({ title: 'Removed', description: 'Stock restored to inventory.', type: 'info' })
    },
  })

  const addSubTaskMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/projects/${id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add sub-task')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      setNewSubTaskName('')
      setShowAddSubTask(false)
      setExpandedSubTasks((prev) => ({ ...prev, [data.id]: true }))
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
  })

  const updateSubTaskMutation = useMutation({
    mutationFn: async ({ subTaskId, status }: { subTaskId: string; status: string }) => {
      const res = await fetch(`/api/projects/${id}/subtasks/${subTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update sub-task')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  })

  const deleteSubTaskMutation = useMutation({
    mutationFn: async (subTaskId: string) => {
      const res = await fetch(`/api/projects/${id}/subtasks/${subTaskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete sub-task')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Sub-task deleted', description: 'Any stock it used has been restored.', type: 'info' })
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
  })

  if (isLoading) return <div className="p-8 text-gray-500">Loading project detail...</div>
  if (!project || project.error) return <div className="p-8 text-red-500">Project not found.</div>

  const statusOptions = ['PENDING', 'IN_PROGRESS', 'DONE']
  const statusStyle: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    DONE: 'bg-green-100 text-green-700',
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddSubTask(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
          >
            <Layers className="w-4 h-4" /> Add Sub-task / Part
          </button>
          <button
            onClick={() => setAddComponentTarget(null)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* New sub-task inline form */}
      {showAddSubTask && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-2">
          <input
            type="text"
            autoFocus
            placeholder="e.g. Base, Joint 1, Gripper..."
            value={newSubTaskName}
            onChange={(e) => setNewSubTaskName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newSubTaskName.trim() && addSubTaskMutation.mutate(newSubTaskName.trim())}
            className="flex-1 p-2.5 text-sm border border-gray-300 rounded-lg"
          />
          <button
            onClick={() => newSubTaskName.trim() && addSubTaskMutation.mutate(newSubTaskName.trim())}
            disabled={!newSubTaskName.trim() || addSubTaskMutation.isPending}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setShowAddSubTask(false); setNewSubTaskName('') }}
            className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Sub-tasks / Parts — each with its own component list */}
      {project.subTasks && project.subTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" /> Parts / Sub-tasks ({project.subTasks.length})
          </h2>
          {project.subTasks.map((st: any) => {
            const expanded = !!expandedSubTasks[st.id]
            return (
              <div key={st.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-4 flex items-center justify-between gap-3 bg-gray-50/50">
                  <button
                    onClick={() => setExpandedSubTasks((prev) => ({ ...prev, [st.id]: !prev[st.id] }))}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-semibold text-gray-900">{st.name}</span>
                    <span className="text-xs text-gray-400">
                      {st.components?.length || 0} product{st.components?.length === 1 ? '' : 's'} used
                    </span>
                  </button>
                  <select
                    value={st.status}
                    onChange={(e) => updateSubTaskMutation.mutate({ subTaskId: st.id, status: e.target.value })}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${statusStyle[st.status] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setAddComponentTarget(st.id)}
                    className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
                  >
                    + Add Product
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete sub-task "${st.name}"? Any stock it used will be restored.`)) {
                        deleteSubTaskMutation.mutate(st.id)
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Delete sub-task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {expanded && (
                  <ComponentsTable
                    components={st.components}
                    onRemove={(componentId) => removeComponentMutation.mutate(componentId)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* General project-level components (no sub-task) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50">
          <h2 className="text-base font-semibold text-gray-900">
            {project.subTasks?.length > 0 ? 'General Products (not tied to a part)' : 'Project Products'} ({project.components?.length || 0})
          </h2>
        </div>
        <ComponentsTable
          components={project.components}
          onRemove={(componentId) => removeComponentMutation.mutate(componentId)}
        />
      </div>

      {/* Add Component Modal — works for both general and sub-task targets */}
      {addComponentTarget !== undefined && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">
              Add Product{addComponentTarget ? ` to "${project.subTasks?.find((s: any) => s.id === addComponentTarget)?.name}"` : ''}
            </h2>

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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Source Invoice No. (Optional)</label>
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
              <button onClick={closeAddComponentModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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
                      subTaskId: addComponentTarget || undefined,
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

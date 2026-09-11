'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Wrench } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { COMPONENT_STATUS_OPTIONS, STATUS_BADGE_STYLE } from '@/lib/componentStatus'
import { formatDate } from '@/lib/utils'

const emptyForm = {
  name: '',
  category: '',
  serialNumber: '',
  status: 'AVAILABLE_STOCK',
  assignedTo: '',
  refundable: false,
  purchaseDate: '',
  purchasePrice: '' as string | number,
  notes: '',
}

export default function AssetsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [editing, setEditing] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['assets', search, statusFilter],
    queryFn: () =>
      fetch(`/api/assets?search=${encodeURIComponent(search)}&status=${statusFilter}`).then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to create asset')
      return d
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast({ title: 'Asset added', type: 'success' })
      setShowAdd(false)
      setForm(emptyForm)
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/assets/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to update asset')
      return d
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast({ title: 'Asset updated', type: 'success' })
      setEditing(null)
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, type: 'error' }),
  })

  const quickStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete asset')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast({ title: 'Asset deleted', type: 'info' })
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete asset', type: 'error' }),
  })

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" /> Assets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Company-owned tools and equipment — multimeters, drills, etc. — not consumable component stock.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, category, serial no, or who has it..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
        >
          <option value="">All Statuses</option>
          {COMPONENT_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs border-b">
              <th className="p-4">Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Serial No.</th>
              <th className="p-4">Status</th>
              <th className="p-4">Assigned To</th>
              <th className="p-4">Purchase Date</th>
              <th className="p-4">Price</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : data?.assets?.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">No assets yet. Click &ldquo;Add Asset&rdquo; above.</td></tr>
            ) : (
              data?.assets?.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="p-4 font-semibold text-gray-900">{a.name}</td>
                  <td className="p-4 text-gray-600">{a.category || '—'}</td>
                  <td className="p-4 text-gray-600 font-mono text-xs">{a.serialNumber || '—'}</td>
                  <td className="p-4">
                    <select
                      value={a.status}
                      onChange={(e) => quickStatusMutation.mutate({ id: a.id, status: e.target.value })}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_BADGE_STYLE[a.status] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {COMPONENT_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-gray-600">
                    {a.assignedTo || '—'}
                    {a.assignedTo && a.refundable && (
                      <span className="ml-1.5 text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-semibold">Borrowed</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 text-xs">{a.purchaseDate ? formatDate(a.purchaseDate) : '—'}</td>
                  <td className="p-4 text-gray-600">{a.purchasePrice ? `₹${a.purchasePrice}` : '—'}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing({
                        id: a.id, name: a.name, category: a.category || '', serialNumber: a.serialNumber || '',
                        status: a.status, assignedTo: a.assignedTo || '', refundable: a.refundable,
                        purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0, 10) : '', purchasePrice: a.purchasePrice ?? '', notes: a.notes || '',
                      })}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirm(`Delete asset "${a.name}"?`) && deleteMutation.mutate(a.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
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

      {(showAdd || editing) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Asset' : 'Add Asset'}</h2>
            {(() => {
              const state = editing || form
              const setState = editing ? setEditing : setForm
              return (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Fluke Multimeter"
                      value={state.name}
                      onChange={(e) => setState({ ...state, name: e.target.value })}
                      className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                      <input
                        type="text"
                        placeholder="e.g. Testing Equipment"
                        value={state.category}
                        onChange={(e) => setState({ ...state, category: e.target.value })}
                        className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Serial No. <span className="font-normal text-slate-400">(optional)</span></label>
                      <input
                        type="text"
                        value={state.serialNumber}
                        onChange={(e) => setState({ ...state, serialNumber: e.target.value })}
                        className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                      <select
                        value={state.status}
                        onChange={(e) => setState({ ...state, status: e.target.value })}
                        className="w-full p-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        {COMPONENT_STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Assigned To <span className="font-normal text-slate-400">(team/person)</span></label>
                      <input
                        type="text"
                        placeholder="e.g. R&D Team"
                        value={state.assignedTo}
                        onChange={(e) => setState({ ...state, assignedTo: e.target.value })}
                        className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!state.refundable}
                      onChange={(e) => setState({ ...state, refundable: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    Borrowed / expected back (refundable)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        value={state.purchaseDate}
                        onChange={(e) => setState({ ...state, purchaseDate: e.target.value })}
                        className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Price</label>
                      <input
                        type="number"
                        value={state.purchasePrice}
                        onChange={(e) => setState({ ...state, purchasePrice: e.target.value ? Number(e.target.value) : '' })}
                        className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                    <input
                      type="text"
                      value={state.notes}
                      onChange={(e) => setState({ ...state, notes: e.target.value })}
                      className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )
            })()}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAdd(false); setEditing(null); setForm(emptyForm) }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const state = editing || form
                  if (!state.name.trim()) return toast({ title: 'Name is required', type: 'error' })
                  if (editing) updateMutation.mutate(state)
                  else createMutation.mutate(state)
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editing ? 'Save Changes' : 'Add Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

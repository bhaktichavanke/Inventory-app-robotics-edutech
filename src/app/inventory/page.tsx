'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Boxes, Search, Download, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', search, showLowStockOnly],
    queryFn: () =>
      fetch(`/api/products?search=${encodeURIComponent(search)}${showLowStockOnly ? '&lowStock=true' : ''}`).then((r) =>
        r.json()
      ),
  })

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/excel', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Import failed')

      toast({
        title: 'Excel Import Completed!',
        description: `Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`,
        type: 'success',
      })
      refetch()
    } catch (err) {
      toast({ title: 'Import Failed', description: err instanceof Error ? err.message : 'Error importing file', type: 'error' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Real-Time Inventory Spreadsheet</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Spreadsheet view tracking Stock = Total Purchased − Total Used in Projects.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelImport}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {importing ? 'Importing...' : 'Import Excel'}
          </button>
          <a
            href="/api/excel?type=inventory"
            download
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all"
          >
            <Download className="w-4 h-4" /> Export Inventory Excel
          </a>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search inventory by Part No, Description, Category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-slate-900 font-medium"
          />
        </div>

        <button
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
            showLowStockOnly
              ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${showLowStockOnly ? 'text-amber-600' : 'text-slate-400'}`} />
          Low Stock Warnings Only
        </button>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs border-b border-slate-200 uppercase font-sans font-bold">
                <th className="p-3.5 border-r border-slate-200 text-center">#</th>
                <th className="p-3.5 border-r border-slate-200">Part No.</th>
                <th className="p-3.5 border-r border-slate-200">Item Description</th>
                <th className="p-3.5 border-r border-slate-200">Category</th>
                <th className="p-3.5 border-r border-slate-200 text-right">Total Purchased</th>
                <th className="p-3.5 border-r border-slate-200 text-right">Total Used</th>
                <th className="p-3.5 border-r border-slate-200 text-right bg-blue-50/90 text-blue-950 font-extrabold">Current Stock</th>
                <th className="p-3.5 border-r border-slate-200 text-right">Unit Price</th>
                <th className="p-3.5 border-r border-slate-200 text-right">Total Value</th>
                <th className="p-3.5">Last Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">Loading spreadsheet...</td>
                </tr>
              ) : data?.products?.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">No matching inventory items.</td>
                </tr>
              ) : (
                data?.products?.map((p: any, idx: number) => {
                  const totalVal = (p.currentStock || 0) * (p.unitPrice || 0)
                  return (
                    <tr key={p.id} className={`hover:bg-blue-50/40 transition-colors ${p.isLowStock ? 'bg-amber-50/60' : ''}`}>
                      <td className="p-3 border-r border-slate-200 text-slate-400 text-center font-sans">{idx + 1}</td>
                      <td className="p-3 border-r border-slate-200 font-bold text-blue-700">
                        <a href={`/products/${p.id}`} className="hover:underline">
                          {p.partNo || <span className="text-slate-400 italic font-sans font-normal">no part no.</span>}
                        </a>
                      </td>
                      <td className="p-3 border-r border-slate-200 font-sans font-semibold text-slate-900">{p.description}</td>
                      <td className="p-3 border-r border-slate-200 font-sans text-slate-600 font-medium">{p.category || '—'}</td>
                      <td className="p-3 border-r border-slate-200 text-right text-slate-700 font-medium">{p.totalPurchased}</td>
                      <td className="p-3 border-r border-slate-200 text-right text-red-600 font-bold">{p.totalUsed}</td>
                      <td className={`p-3 border-r border-slate-200 text-right font-extrabold text-sm bg-blue-50/40 ${
                        p.isLowStock ? 'text-amber-700 bg-amber-100/50' : 'text-emerald-700'
                      }`}>
                        {p.currentStock}
                        {p.isLowStock && <span className="ml-1 font-sans text-xs">⚠️</span>}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-right font-sans text-slate-700 font-medium">{formatCurrency(p.unitPrice)}</td>
                      <td className="p-3 border-r border-slate-200 text-right font-sans font-extrabold text-slate-900">{formatCurrency(totalVal)}</td>
                      <td className="p-3 font-sans text-slate-500 text-[11px] font-medium">{formatDate(p.lastPurchaseDate)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

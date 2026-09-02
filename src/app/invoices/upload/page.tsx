'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload, FileText, AlertTriangle, CheckCircle2, Plus, Trash2, 
  Sparkles, ArrowLeft, Loader2, DollarSign, Calendar
} from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { validateInvoiceTotals } from '@/lib/validations'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

interface ExtractedItem {
  partNo: string
  description: string
  category: string
  quantity: number
  unitPrice: number
  baseAmount: number
  gstAmount: number
  totalAmount: number
  flags?: {
    partNo?: boolean
    description?: boolean
    category?: boolean
    quantity?: boolean
    unitPrice?: boolean
    baseAmount?: boolean
    totalAmount?: boolean
  }
}

interface ExtractionFormState {
  invoiceNo: string
  poNumber: string
  supplierName: string
  invoiceDate: string
  receivedDate: string
  status: 'RECEIVED' | 'NOT_RECEIVED'
  baseAmount: number
  gstAmount: number
  cgst: number
  sgst: number
  igst: number
  otherTax: number
  totalAmount: number
  items: ExtractedItem[]
  flags: Record<string, boolean>
}

export default function UploadInvoicePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tempFileInfo, setTempFileInfo] = useState<{ tempFilePath: string; tempFileName: string; fileType: string } | null>(null)

  const [form, setForm] = useState<ExtractionFormState | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      setFile(selected)
      setFilePreviewUrl(URL.createObjectURL(selected))
    }
  }

  const handleUploadAndExtract = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const ext = data.extracted
      setTempFileInfo({
        tempFilePath: data.tempFilePath,
        tempFileName: data.tempFileName,
        fileType: data.fileType,
      })

      setForm({
        invoiceNo: ext.invoiceNo || '',
        poNumber: ext.poNumber || '',
        supplierName: ext.supplierName || '',
        invoiceDate: ext.invoiceDate || new Date().toISOString().split('T')[0],
        receivedDate: '', // Leave blank by default per requirement
        status: 'NOT_RECEIVED',
        baseAmount: ext.baseAmount || 0,
        gstAmount: ext.gstAmount || 0,
        cgst: ext.cgst || 0,
        sgst: ext.sgst || 0,
        igst: ext.igst || 0,
        otherTax: ext.otherTax || 0,
        totalAmount: ext.totalAmount || 0,
        items: (ext.items || []).map((it: any) => ({
          partNo: it.partNo || '',
          description: it.description || '',
          category: it.category || 'General',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          baseAmount: it.baseAmount || 0,
          gstAmount: it.gstAmount || 0,
          totalAmount: it.totalAmount || 0,
          flags: it.flags || {},
        })),
        flags: ext.flags || {},
      })

      if (ext.error) {
        toast({ title: 'AI Extraction Notice', description: ext.error, type: 'info' })
      } else {
        toast({ title: 'Invoice Extracted!', description: 'Please review and verify the extracted data below.', type: 'success' })
      }
      if (data.storageError) {
        toast({
          title: 'Document Not Saved',
          description: 'Extraction succeeded, but the original file could not be stored — you can still save the invoice without it attached.',
          type: 'info',
        })
      }
    } catch (err) {
      toast({ title: 'Upload Failed', description: err instanceof Error ? err.message : 'Unknown error', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const updateItem = (index: number, key: keyof ExtractedItem, val: any) => {
    if (!form) return
    const updatedItems = [...form.items]
    const item = { ...updatedItems[index], [key]: val }
    
    // Auto-calculate base/total if quantity or price changes
    if (key === 'quantity' || key === 'unitPrice') {
      const qty = key === 'quantity' ? Number(val) : item.quantity
      const price = key === 'unitPrice' ? Number(val) : item.unitPrice
      item.baseAmount = qty * price
      item.totalAmount = item.baseAmount + (item.gstAmount || 0)
    }
    
    updatedItems[index] = item
    setForm({ ...form, items: updatedItems })
  }

  const addItem = () => {
    if (!form) return
    setForm({
      ...form,
      items: [
        ...form.items,
        { partNo: '', description: '', category: 'General', quantity: 1, unitPrice: 0, baseAmount: 0, gstAmount: 0, totalAmount: 0 },
      ],
    })
  }

  const removeItem = (index: number) => {
    if (!form) return
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) })
  }

  const handleSaveInvoice = async () => {
    if (!form) return
    if (!form.invoiceNo) {
      toast({ title: 'Validation Error', description: 'Invoice number is required.', type: 'error' })
      return
    }
    if (form.items.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one item is required.', type: 'error' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          filePath: tempFileInfo?.tempFilePath,
          fileName: tempFileInfo?.tempFileName,
          fileType: tempFileInfo?.fileType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save invoice')

      toast({ title: 'Success!', description: `Invoice ${form.invoiceNo} saved & inventory updated!`, type: 'success' })
      router.push(`/invoices/${data.id}`)
    } catch (err) {
      toast({ title: 'Save Error', description: err instanceof Error ? err.message : 'Error saving invoice', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const taxValidation = form ? validateInvoiceTotals({
    baseAmount: Number(form.baseAmount),
    cgst: Number(form.cgst),
    sgst: Number(form.sgst),
    igst: Number(form.igst),
    otherTax: Number(form.otherTax),
    totalAmount: Number(form.totalAmount),
  }) : null

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload & Extract Invoice</h1>
          <p className="text-sm text-gray-500">Extract fields automatically using AI OCR, review, and update inventory.</p>
        </div>
      </div>

      {/* Step 1: Upload Box */}
      {!form && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            id="invoice-file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <label htmlFor="invoice-file" className="cursor-pointer flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {file ? file.name : 'Click to upload invoice or camera photo'}
              </p>
              <p className="text-sm text-gray-500 mt-1">Supports JPG, PNG, WebP, and PDF invoices</p>
            </div>
          </label>

          {file && (
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={handleUploadAndExtract}
                disabled={uploading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 shadow-md"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Extracting with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> Run AI Extraction
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Extraction Review & Verification */}
      {form && (
        <div className="space-y-6">
          {/* Tax Validation Warning Banner */}
          {taxValidation && !taxValidation.valid && (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Tax Math Mismatch Warning</p>
                <p className="text-xs mt-1">
                  Base Amount + Taxes (₹{taxValidation.expected}) does not equal Total Amount (₹{form.totalAmount}). Please double check prices and taxes before saving.
                </p>
              </div>
            </div>
          )}

          {/* Header Info Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Invoice Information Review
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Invoice Number *
                  {form.flags?.invoiceNo && <span className="text-amber-600 ml-1">(Flagged for verification)</span>}
                </label>
                <input
                  type="text"
                  value={form.invoiceNo}
                  onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                  className={`w-full p-2.5 text-sm border rounded-lg ${form.flags?.invoiceNo ? 'border-amber-500 bg-amber-50' : 'border-gray-300'}`}
                  placeholder="e.g. INV-1024"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">PO Number</label>
                <input
                  type="text"
                  value={form.poNumber}
                  onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
                  placeholder="e.g. PO-2025-001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  value={form.supplierName}
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  className={`w-full p-2.5 text-sm border rounded-lg ${form.flags?.supplierName ? 'border-amber-500 bg-amber-50' : 'border-gray-300'}`}
                  placeholder="Supplier Company Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Received Date (Blank = Pending)</label>
                <input
                  type="date"
                  value={form.receivedDate}
                  onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="NOT_RECEIVED">Not Received</option>
                  <option value="RECEIVED">Received</option>
                </select>
              </div>
            </div>

            {/* Amounts Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-4 border-t">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Base Amount (₹)</label>
                <input
                  type="number"
                  value={form.baseAmount}
                  onChange={(e) => setForm({ ...form, baseAmount: Number(e.target.value) })}
                  className="w-full p-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">CGST (₹)</label>
                <input
                  type="number"
                  value={form.cgst}
                  onChange={(e) => {
                    const cgst = Number(e.target.value)
                    setForm({ ...form, cgst, gstAmount: cgst + form.sgst + form.igst })
                  }}
                  className="w-full p-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">SGST (₹)</label>
                <input
                  type="number"
                  value={form.sgst}
                  onChange={(e) => {
                    const sgst = Number(e.target.value)
                    setForm({ ...form, sgst, gstAmount: form.cgst + sgst + form.igst })
                  }}
                  className="w-full p-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">IGST (₹)</label>
                <input
                  type="number"
                  value={form.igst}
                  onChange={(e) => {
                    const igst = Number(e.target.value)
                    setForm({ ...form, igst, gstAmount: form.cgst + form.sgst + igst })
                  }}
                  className="w-full p-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Other Tax (₹)</label>
                <input
                  type="number"
                  value={form.otherTax}
                  onChange={(e) => setForm({ ...form, otherTax: Number(e.target.value) })}
                  className="w-full p-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })}
                  className="w-full p-2 text-sm font-bold border border-blue-300 bg-blue-50 text-blue-900 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Line Items ({form.items.length})</h2>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs border-b">
                    <th className="p-3">Part No. <span className="font-normal text-gray-400">(optional)</span></th>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 w-36">Category</th>
                    <th className="p-3 w-20">Qty</th>
                    <th className="p-3 w-28">Unit Price</th>
                    <th className="p-3 w-28">Base Amt</th>
                    <th className="p-3 w-28">GST</th>
                    <th className="p-3 w-32">Total</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.partNo}
                          onChange={(e) => updateItem(idx, 'partNo', e.target.value)}
                          placeholder="e.g. MTR-001 (leave blank if unknown)"
                          className={`w-full p-2 border rounded-lg text-sm ${item.flags?.partNo ? 'bg-amber-50 border-amber-400' : 'border-gray-200'}`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.category || 'General'}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          {PRODUCT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.baseAmount}
                          onChange={(e) => updateItem(idx, 'baseAmount', Number(e.target.value))}
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.gstAmount}
                          onChange={(e) => updateItem(idx, 'gstAmount', Number(e.target.value))}
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.totalAmount}
                          onChange={(e) => updateItem(idx, 'totalAmount', Number(e.target.value))}
                          className="w-full p-2 border border-blue-200 bg-blue-50 font-medium rounded-lg text-sm"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setForm(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Re-upload File
            </button>
            <button
              onClick={handleSaveInvoice}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-md"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Save Invoice & Update Inventory
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

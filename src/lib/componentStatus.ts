// Physical stock/lifecycle status, shared between Products (components) and
// Assets (tools/equipment). Distinct from Product.status, which is the
// catalog ACTIVE/DISCONTINUED lifecycle.
export const COMPONENT_STATUS_OPTIONS = [
  { value: 'AVAILABLE_STOCK', label: 'Available Stock' },
  { value: 'USED_IN_PROJECT', label: 'Used in Project' },
  { value: 'USED_IN_PRODUCT', label: 'Used in Product' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'WAIVED', label: 'Waived' },
  { value: 'DISCARDED', label: 'Discarded' },
  { value: 'FAULTY', label: 'Faulty' },
] as const

export type ComponentStatusValue = (typeof COMPONENT_STATUS_OPTIONS)[number]['value']

export function componentStatusLabel(value: string | null | undefined): string {
  return COMPONENT_STATUS_OPTIONS.find((s) => s.value === value)?.label || 'Available Stock'
}

// Statuses that mean the stock is no longer available for use — moving a
// product/asset into one of these prompts for a quantity to deduct from
// currentStock, rather than silently guessing an amount.
export const STOCK_REDUCING_STATUSES: string[] = ['USED_IN_PRODUCT', 'MISSING', 'WAIVED', 'DISCARDED', 'FAULTY']

export const STATUS_BADGE_STYLE: Record<string, string> = {
  AVAILABLE_STOCK: 'bg-green-100 text-green-700',
  USED_IN_PROJECT: 'bg-blue-100 text-blue-700',
  USED_IN_PRODUCT: 'bg-indigo-100 text-indigo-700',
  MISSING: 'bg-red-100 text-red-700',
  WAIVED: 'bg-amber-100 text-amber-700',
  DISCARDED: 'bg-slate-200 text-slate-600',
  FAULTY: 'bg-orange-100 text-orange-700',
}

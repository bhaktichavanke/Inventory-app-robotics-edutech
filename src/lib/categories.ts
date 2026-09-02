// Single source of truth for product categories. Imported by the AI
// extraction prompt (server) and the product/invoice forms (client) so the
// dropdown options and the values the AI is allowed to pick from never
// drift apart. Keep this list short and stable — changing it doesn't
// require a DB migration (category is a free-text column) but does change
// what the AI is told to classify into and what the UI lets people pick.
export const PRODUCT_CATEGORIES = ['Motors', 'Microcontrollers', 'Drivers', 'Sensors', 'Power', 'Passive', 'General'] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

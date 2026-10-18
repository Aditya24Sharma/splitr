export interface ParsedReceiptItem {
  rawName: string | null
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ParsedReceipt {
  store: string | null
  purchasedAt: string | null
  items: ParsedReceiptItem[]
  subtotal: number
  tax: number
  total: number
  warnings: string[]
}

export type { PersonShare, SplitItem, ItemizedInput, ItemizedResult } from '@/lib/split'

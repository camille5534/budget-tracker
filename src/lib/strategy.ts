export type HoldingRow = {
  id: string
  symbol: string
  name: string
  kind: 'letf' | 'normal' | 'cash'
  qty: number
  avg_cost: number
  close: number | null
}

export type StrategyResult = {
  letfValue: number
  cashTotal: number
  poolTotal: number
  letfPct: number
  cashPct: number
  drift: number
  exposure: number
  adjust: number
  status: 'ok' | 'sell' | 'buy'
}

export function marketValue(h: HoldingRow): number {
  return h.qty * (h.close ?? h.avg_cost)
}

export function computeStrategy(
  holdings: HoldingRow[],
  cashAmounts: number[],
  targetPct = 50,
  bandPct = 5
): StrategyResult {
  const mv = (h: HoldingRow) => h.qty * (h.close ?? h.avg_cost)
  const letfValue = holdings.filter(h => h.kind === 'letf').reduce((s, h) => s + mv(h), 0)
  const cashStk   = holdings.filter(h => h.kind === 'cash').reduce((s, h) => s + mv(h), 0)
  const cashTotal = cashStk + cashAmounts.reduce((s, v) => s + v, 0)
  const poolTotal = letfValue + cashTotal

  const letfPct = poolTotal ? (letfValue / poolTotal) * 100 : 0
  const cashPct = poolTotal ? (cashTotal / poolTotal) * 100 : 0
  const drift   = letfPct - targetPct
  const exposure = poolTotal ? (letfValue * 2 / poolTotal) * 100 : 0
  const adjust  = poolTotal * targetPct / 100 - letfValue
  const status: StrategyResult['status'] =
    drift > bandPct ? 'sell' : drift < -bandPct ? 'buy' : 'ok'

  return { letfValue, cashTotal, poolTotal, letfPct, cashPct, drift, exposure, adjust, status }
}

export const fmtNTD = (n: number) =>
  'NT$' + Math.round(n).toLocaleString('en-US')

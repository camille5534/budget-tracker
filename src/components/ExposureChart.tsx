'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

type Snap = {
  snap_date: string
  exposure: number
  letf_pct: number
  target_pct: number
}

export default function ExposureChart({ snaps }: { snaps: Snap[] }) {
  if (!snaps.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        按「記錄今日快照」開始累積曝險走勢。
      </p>
    )
  }

  const data = snaps.map(s => ({
    date:   s.snap_date.slice(0, 10),
    曝險:   Number(s.exposure),
    正二佔比: Number(s.letf_pct),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 11 }}
          domain={['auto', 'auto']}
        />
        <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine
          y={100}
          stroke="#ef4444"
          strokeDasharray="5 4"
          label={{ value: '100%', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
        />
        <Line
          type="monotone"
          dataKey="曝險"
          stroke="#d97706"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="正二佔比"
          stroke="#10b981"
          strokeWidth={1.5}
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

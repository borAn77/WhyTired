import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatShort } from '@/lib/dates'
import type { Chart } from '@/lib/types'

const TITLES: Record<string, string> = {
  weekly_load: 'Training load per week',
  sleep_hours: 'Hours slept per night',
  stress: 'Stress (1–5)',
  resting_hr: 'Resting heart rate (bpm)',
}

const config = {
  value: { label: 'You', color: 'var(--wt-navy-700)' },
} satisfies ChartConfig

// Small charts that support a finding. Only shown inside a cause card; the evidence text
// above them carries the same numbers, so the chart is never the only source of information.
export function MiniChart({ chart }: { chart: Chart }) {
  const data = chart.points.map((point) => ({ ...point, label: formatShort(point.date) }))
  const baseline = chart.points.find((point) => point.baseline !== null)?.baseline ?? null
  const last = data[data.length - 1]
  const weekly = chart.metric === 'weekly_load'
  const title = TITLES[chart.metric] ?? chart.metric
  const summary = `${title}. Latest ${last?.value ?? 'no data'}${baseline !== null ? `, your usual ${baseline}` : ''}.`

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-navy-900">{title}</figcaption>
      <ChartContainer config={config} className="aspect-auto h-32 w-full" role="img" aria-label={summary}>
        {weekly ? (
          <BarChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval={0} fontSize={12} />
            <YAxis hide domain={[0, 'auto']} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {data.map((point, i) => (
                <Cell key={point.date} fill={i === data.length - 1 ? 'var(--wt-coral-600)' : 'var(--wt-navy-500)'} />
              ))}
            </Bar>
            {baseline !== null && (
              <ReferenceLine y={baseline} stroke="var(--wt-navy-900)" strokeDasharray="5 4" strokeWidth={1.5} />
            )}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              interval="preserveStartEnd"
              minTickGap={48}
              fontSize={12}
            />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
            {baseline !== null && (
              <ReferenceLine y={baseline} stroke="var(--wt-navy-500)" strokeDasharray="5 4" strokeWidth={1.5} />
            )}
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--wt-navy-700)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ChartContainer>
      <p className="text-sm text-muted-foreground">
        {weekly ? 'Coral bar = last 7 days. ' : 'Last 28 days. '}
        Dashed line = your usual.
      </p>
    </figure>
  )
}

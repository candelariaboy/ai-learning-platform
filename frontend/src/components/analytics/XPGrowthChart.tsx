import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import type { XpGrowthPoint } from "../../types"

type XPGrowthChartProps = {
  data: XpGrowthPoint[]
}

export default function XPGrowthChart({ data }: XPGrowthChartProps) {
  const chartData = data.map((item) => ({
    week: item.week_start.slice(0, 10),
    xp: item.xp_gained,
  }))

  return (
    <div className="rounded-3xl border border-ink/10 bg-paper/70 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Gamification</p>
      <h4 className="mt-2 text-lg font-semibold">XP growth</h4>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="xp"
              stroke="#60a5fa"
              fill="#bfdbfe"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

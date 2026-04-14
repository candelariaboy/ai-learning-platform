import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import type { LearningProgressPoint } from "../../types"

type LearningProgressChartProps = {
  data: LearningProgressPoint[]
}

const formatShortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const formatFullDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function LearningProgressChart({ data }: LearningProgressChartProps) {
  const sorted = [...data]
    .filter((item) => item.completed_at)
    .sort((a, b) => (a.completed_at || "").localeCompare(b.completed_at || ""))
  let cumulative = 0
  const chartData = sorted.map((item) => {
    cumulative += 1
    return {
      date: (item.completed_at || "").slice(0, 10),
      completed: cumulative,
    }
  })

  return (
    <div className="rounded-3xl border border-ink/10 bg-paper/70 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Learning Progress</p>
      <h4 className="mt-2 text-lg font-semibold">Completed steps over time</h4>
      <div className="mt-4 h-48">
        {chartData.length === 0 ? (
          <p className="text-sm text-ink/60">No completed learning steps yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatShortDate} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip labelFormatter={(value) => formatFullDate(String(value))} />
              <Line type="monotone" dataKey="completed" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

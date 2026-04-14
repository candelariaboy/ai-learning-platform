import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import type { EngagementCommit } from "../../types"

type CommitActivityChartProps = {
  data: EngagementCommit[]
}

export default function CommitActivityChart({ data }: CommitActivityChartProps) {
  const chartData = data.map((item) => ({
    week: item.week_start.slice(0, 10),
    commits: item.commit_count,
  }))

  return (
    <div className="rounded-3xl border border-ink/10 bg-paper/70 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Coding Activity</p>
      <h4 className="mt-2 text-lg font-semibold">Commits per week</h4>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="commits"
              stroke="#34d399"
              strokeWidth={3}
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { LoginActivityTrends, LoginLive } from "../../types"

type AdminLoginActivitySectionProps = {
  data: LoginActivityTrends
  live: LoginLive | null
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

export default function AdminLoginActivitySection({ data, live }: AdminLoginActivitySectionProps) {
  const dailyChart = data.daily_counts.map((item) => ({
    date: item.date,
    logins: item.count,
  }))
  const hourChart = data.peak_hours.map((item) => ({
    hour: `${item.hour}:00`,
    logins: item.count,
  }))
  const weeklyChart = data.weekly_active.map((item) => ({
    week: item.week_start,
    active: item.active_users,
  }))
  const topStreaks = [...data.streaks]
    .sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0))
    .slice(0, 6)
  const liveChart = (live?.points || []).map((item) => ({
    time: item.time,
    logins: item.count,
  }))
  const lastLiveTime = liveChart.length > 0 ? liveChart[liveChart.length - 1].time : ""

  return (
    <section className="mt-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Login Activity</p>
        <h3 className="mt-2 text-2xl font-semibold">Admin Insights</h3>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Live Tonight</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold">
              Rolling {live?.window_hours || 12} hours · updates every 30s
            </h4>
            <span className="rounded-full border border-ink/10 px-3 py-1 text-[11px] font-semibold text-ink/60">
              PH time (UTC+8)
            </span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={liveChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval={5}
                  tickFormatter={(value) => (value === lastLiveTime ? `${value} (Now)` : value)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="logins" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Daily Logins</p>
          <h4 className="mt-2 text-lg font-semibold">Last 30 days</h4>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatShortDate} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(value) => formatFullDate(String(value))} />
                <Line type="monotone" dataKey="logins" stroke="#38bdf8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Peak Hours</p>
          <h4 className="mt-2 text-lg font-semibold">Most active times</h4>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="logins" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Weekly Active Users</p>
          <h4 className="mt-2 text-lg font-semibold">Engaged students</h4>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DA" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="active" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Login Streaks</p>
        <h4 className="mt-2 text-lg font-semibold">Top active students</h4>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {topStreaks.length === 0 ? (
            <p className="text-sm text-ink/60">No streak data yet.</p>
          ) : (
            topStreaks.map((item, index) => (
              <div
                key={`${item.user_id}-${index}`}
                className="flex items-center justify-between rounded-xl border border-ink/10 bg-paper/60 px-3 py-2"
              >
                <span>{item.username || `Student ${item.user_id}`}</span>
                <span className="text-xs font-semibold">{item.current_streak} days</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

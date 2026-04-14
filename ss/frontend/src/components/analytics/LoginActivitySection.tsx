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
import type { LoginActivity } from "../../types"

type LoginActivitySectionProps = {
  data: LoginActivity
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

export default function LoginActivitySection({ data }: LoginActivitySectionProps) {
  const dailyChart = data.daily_counts.map((item) => ({
    date: item.date,
    logins: item.count,
  }))
  const hourChart = data.peak_hours.map((item) => ({
    hour: `${item.hour}:00`,
    logins: item.count,
  }))
  const recentLogins = data.recent_logins || []
  const formatDevice = (ua?: string | null) => {
    if (!ua) return "Unknown device"
    const lower = ua.toLowerCase()
    const browser = lower.includes("edg")
      ? "Edge"
      : lower.includes("chrome")
        ? "Chrome"
        : lower.includes("firefox")
          ? "Firefox"
          : lower.includes("safari")
            ? "Safari"
            : "Browser"
    const os = lower.includes("windows")
      ? "Windows"
      : lower.includes("mac")
        ? "macOS"
        : lower.includes("android")
          ? "Android"
          : lower.includes("iphone") || lower.includes("ios")
            ? "iOS"
            : "OS"
    return `${browser} / ${os}`
  }

  return (
    <section className="mt-12 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Analytics</p>
        <h3 className="mt-2 text-2xl font-semibold">Login Activity</h3>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Recent Logins</p>
          <h4 className="mt-2 text-lg font-semibold">Latest sessions</h4>
          <div className="mt-4 space-y-2 text-sm text-ink/70">
            {recentLogins.length === 0 ? (
              <p className="text-sm text-ink/60">No login history yet.</p>
            ) : (
              recentLogins.slice(0, 6).map((item, index) => (
                <div
                  key={`${item.login_timestamp}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-ink/10 bg-paper/60 px-3 py-2"
                >
                  <span>{new Date(item.login_timestamp).toLocaleString()}</span>
                  <span className="text-xs text-ink/50">
                    {formatDevice(item.device)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Daily Logins</p>
          <h4 className="mt-2 text-lg font-semibold">Last 14 days</h4>
          <div className="mt-4 h-56">
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
          <div className="mt-4 h-56">
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
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Login Streak</p>
        <div className="mt-3 flex items-center justify-between">
          <h4 className="text-xl font-semibold">{data.streak.current_streak} days</h4>
          <span className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
            Keep the streak going
          </span>
        </div>
        <p className="mt-2 text-sm text-ink/60">
          Streaks are calculated using Asia/Manila local time.
        </p>
      </div>
    </section>
  )
}

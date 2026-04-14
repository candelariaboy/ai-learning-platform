import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import AdminFrame from "../components/AdminFrame"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  signOutAdmin,
  fetchAdminAnalytics,
  fetchAdminDeepAnalytics,
  fetchAdminEvaluationMetrics,
  fetchAdminStudents,
  fetchCohortComparison,
  fetchLoginLive,
  fetchLoginTrends,
  fetchResearchAnalytics,
  getStoredAdminAuth,
} from "../lib/api"
import type {
  AdminAnalytics,
  AdminDeepAnalytics,
  AdminEvaluationMetrics,
  AdminStudentSummary,
  CohortComparison,
  LoginActivityTrends,
  LoginLive,
  ResearchAnalytics,
} from "../types"
import NotFoundPage from "./NotFoundPage"

type MetricCardProps = {
  title: string
  value: string
  icon: string
}

function formatRealtimeDateTime(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`
}
function toIsoDateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateDDMMYYYY(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  const day = String(parsed.getDate()).padStart(2, "0")
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const year = parsed.getFullYear()
  return `${day}/${month}/${year}`
}

function formatTimeToAmPm(value: string) {
  const [hourPart, minutePart] = value.split(":")
  const hour = Number(hourPart)
  const minute = Number(minutePart)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value
  const suffix = hour >= 12 ? "PM" : "AM"
  const normalizedHour = hour % 12 || 12
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`
}
function buildMonthToDateRows(dailyCounts: LoginActivityTrends["daily_counts"]) {
  const countMap = new Map(dailyCounts.map((item) => [item.date, item.count]))
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const rows: Array<{ date: string; count: number }> = []
  for (let cursor = new Date(startOfMonth); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const date = toIsoDateLocal(cursor)
    rows.push({ date, count: countMap.get(date) ?? 0 })
  }
  return rows
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-[#e4e7ec] bg-white p-4 shadow-[0_6px_18px_rgba(17,24,39,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#f2f4f7] text-lg">{icon}</div>
        <div className="text-right">
          <p className="text-xs text-[#667085]">{title}</p>
          <p className="mt-1 text-3xl font-bold text-[#101828]">{value}</p>
        </div>
      </div>
    </article>
  )
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const auth = getStoredAdminAuth()
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [deepAnalytics, setDeepAnalytics] = useState<AdminDeepAnalytics | null>(null)
  const [evaluation, setEvaluation] = useState<AdminEvaluationMetrics | null>(null)
  const [research, setResearch] = useState<ResearchAnalytics | null>(null)
  const [students, setStudents] = useState<AdminStudentSummary[]>([])
  const [cohort, setCohort] = useState<CohortComparison | null>(null)
  const [loginTrends, setLoginTrends] = useState<LoginActivityTrends | null>(null)
  const [loginLive, setLoginLive] = useState<LoginLive | null>(null)
  const [lastRealtimeSync, setLastRealtimeSync] = useState(() => formatRealtimeDateTime())
  const realtimeFetchInFlight = useRef(false)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastRealtimeSync(formatRealtimeDateTime())
    }, 1000)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!auth.token) return
    let alive = true

    const messageFromError = (error: unknown) => {
      if (error instanceof Error) return error.message
      if (typeof error === "string") return error
      return "Unknown error"
    }

    async function loadDashboard() {
      setLoading(true)
      setError("")
      try {
        const results = await Promise.allSettled([
          fetchAdminAnalytics(auth.token),
          fetchAdminDeepAnalytics(auth.token, "7d"),
          fetchAdminEvaluationMetrics(auth.token),
          fetchResearchAnalytics(auth.token),
          fetchAdminStudents(auth.token),
          fetchCohortComparison(auth.token),
          fetchLoginTrends(auth.token),
          fetchLoginLive(auth.token),
        ])
        if (!alive) return

        const [
          analyticsResult,
          deepResult,
          evaluationResult,
          researchResult,
          studentsResult,
          cohortResult,
          trendsResult,
          liveResult,
        ] = results

        if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value)
        if (deepResult.status === "fulfilled") setDeepAnalytics(deepResult.value)
        if (evaluationResult.status === "fulfilled") setEvaluation(evaluationResult.value)
        if (researchResult.status === "fulfilled") setResearch(researchResult.value)
        if (studentsResult.status === "fulfilled") setStudents(studentsResult.value || [])
        if (cohortResult.status === "fulfilled") setCohort(cohortResult.value)
        if (trendsResult.status === "fulfilled") setLoginTrends(trendsResult.value)
        if (liveResult.status === "fulfilled") setLoginLive(liveResult.value)

        const failed = results.filter((result) => result.status === "rejected")
        if (failed.length === results.length) {
          const messages = failed.map((result) => messageFromError(result.reason))
          const allUnauthorized = messages.every((message) => message.includes("401"))
          if (allUnauthorized) {
            signOutAdmin("/admin-login")
            return
          }
          setError("Failed to load admin dashboard data.")
        } else {
          setError("")
        }
      } catch {
        if (!alive) return
        setError("Failed to load admin dashboard data.")
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      alive = false
    }
  }, [auth.token])

  useEffect(() => {
    if (!auth.token) return
    let alive = true

    const refreshLoginInsights = async () => {
      if (realtimeFetchInFlight.current) return
      realtimeFetchInFlight.current = true
      try {
        const [trendsPayload, livePayload] = await Promise.all([
          fetchLoginTrends(auth.token),
          fetchLoginLive(auth.token),
        ])
        if (!alive) return
        setLoginTrends(trendsPayload)
        setLoginLive(livePayload)
      } catch {
        if (!alive) return
      } finally {
        realtimeFetchInFlight.current = false
      }
    }

    const interval = window.setInterval(refreshLoginInsights, 1000)
    const onFocus = () => {
      refreshLoginInsights()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshLoginInsights()
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      alive = false
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [auth.token])

  const topStudents = useMemo(() => [...students].sort((a, b) => b.xp - a.xp).slice(0, 10), [students])
  const languageRows = deepAnalytics?.top_languages || []
  const programRows = cohort?.by_program || []
  const loginChartRows = buildMonthToDateRows(loginTrends?.daily_counts || [])
  const peakHourRows = [...(loginTrends?.peak_hours || [])].sort((a, b) => b.count - a.count).slice(0, 3)
  const liveRows = (loginLive?.points || []).slice(-8)
  const topStreakRows = [...(loginTrends?.streaks || [])].sort((a, b) => b.current_streak - a.current_streak).slice(0, 5)
  const maxLiveLogins = Math.max(1, ...liveRows.map((item) => item.count))
  const currentLiveCount = (loginLive?.points || []).slice(-1)[0]?.count ?? 0

  if (!auth.token) {
    return <NotFoundPage message="Sign in as admin to view this page." />
  }

  return (
    <AdminFrame showBuiltInToolbar={false}>
      <div className="text-[#101828]">
          <div className="rounded-2xl border border-[#e4e7ec] bg-white p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#e4e7ec] px-3 py-2">
                <span className="text-sm">Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search students, sections, analytics..."
                  className="w-full border-0 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-[#e4e7ec] bg-white px-3 py-2 text-xs font-semibold text-[#344054]"
                >
                  Notifications
                </button>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d0d5dd] text-xs font-bold text-[#1d2939]">AD</div>
                <div>
                  <p className="text-xs font-semibold text-[#101828]">{auth.username || "Admin"}</p>
                  <p className="text-[11px] text-[#667085]">LSPU Administrator</p>
                </div>
              </div>
            </div>
          </div>

          <h1 className="mt-5 text-2xl font-semibold">Admin Dashboard</h1>

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}

          <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total Students" value={`${analytics?.total_students ?? 0}`} icon="S" />
            <MetricCard title="Active (14 days)" value={`${research?.active_students_14d ?? 0}`} icon="A" />
            <MetricCard title="Completeness" value={`${evaluation?.portfolio_completeness_rate ?? 0}%`} icon="C" />
            <MetricCard title="Relevance (>=4/5)" value={`${evaluation?.recommendation_relevance_rate ?? 0}%`} icon="R" />
          </section>
          <p className="mt-2 text-xs text-[#667085]">
            Recommendation ratings captured: {evaluation?.recommendation_ratings_total ?? 0}
          </p>

          <section className="mt-3">
            <article className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Program Performance</h3>
                <span className="text-xs text-[#667085]">BSCS vs BSIT</span>
              </div>
              <div className="space-y-2">
                {programRows.map((row) => (
                  <div key={row.cohort} className="rounded-xl border border-[#e4e7ec] bg-[#f8fafc] px-3 py-2">
                    <p className="text-sm font-semibold">{row.cohort}</p>
                    <p className="text-xs text-[#667085]">
                      {row.student_count} students | Avg XP {row.avg_xp} | Avg Level {row.avg_level}
                    </p>
                  </div>
                ))}
                {programRows.length === 0 ? <p className="text-xs text-[#667085]">No cohort data available yet.</p> : null}
              </div>
              <button
                type="button"
                className="mt-3 rounded-lg border border-[#e4e7ec] bg-white px-3 py-2 text-xs font-semibold"
                onClick={() => navigate("/admin/leaderboard")}
              >
                Open Leaderboard
              </button>
            </article>
          </section>

          <section className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
            <article className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Login Activity Insights</h3>
                <span className="text-xs text-[#667085]">Live auto-sync - {lastRealtimeSync}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#e4e7ec] bg-[#f8fafc] p-3">
                <div className="min-w-[680px]">
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={loginChartRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dfe4ea" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          interval={2}
                          tickFormatter={(value) => formatDateDDMMYYYY(String(value))}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value) => [`${value}`, "Logins"]}
                          labelFormatter={(value) => formatDateDDMMYYYY(String(value))}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name="Logins"
                          stroke="#3ea2e3"
                          strokeWidth={3}
                          dot={{ r: 2 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {!loading && loginChartRows.length === 0 ? <p className="mt-2 text-xs text-[#667085]">No login trend data yet.</p> : null}
              </div>
              <div className="mt-3 border-t border-[#eef2f6] pt-3">
                <p className="mb-2 text-xs font-semibold text-[#475467]">Peak login hours</p>
                <div className="flex flex-wrap gap-2">
                  {peakHourRows.map((item) => (
                    <span key={item.hour} className="rounded-full border border-[#dfe6ee] bg-[#f8fafc] px-2 py-1 text-xs">
                      {item.hour.toString().padStart(2, "0")}:00 - {item.count}
                    </span>
                  ))}
                  {!loading && peakHourRows.length === 0 ? (
                    <span className="text-xs text-[#667085]">No peak-hour data.</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-[#667085]">
                  Current live count: <span className="font-semibold text-[#101828]">{currentLiveCount}</span>
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Live Login Pulse</h3>
                <span className="text-xs text-[#667085]">
                  {loginLive?.window_hours ?? 12}h / {loginLive?.bucket_minutes ?? 10}m buckets
                </span>
              </div>
              <div className="space-y-2">
                {liveRows.map((item) => (
                  <div key={item.time} className="grid grid-cols-[72px_1fr_36px] items-center gap-2 text-xs">
                    <span className="text-[#667085]">{formatTimeToAmPm(item.time)}</span>
                    <div className="h-2 rounded-full bg-[#eef2f6]">
                      <div
                        className="h-full rounded-full bg-[#16b364]"
                        style={{ width: `${Math.max(6, (item.count / maxLiveLogins) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right font-semibold">{item.count}</span>
                  </div>
                ))}
                {!loading && liveRows.length === 0 ? (
                  <p className="text-xs text-[#667085]">No live login data yet.</p>
                ) : null}
              </div>
              <div className="mt-3 border-t border-[#eef2f6] pt-3">
                <p className="mb-2 text-xs font-semibold text-[#475467]">Top login streaks</p>
                <ol className="space-y-1 pl-5">
                  {topStreakRows.map((item) => (
                    <li key={`${item.user_id}-${item.username}`} className="text-xs">
                      <span className="font-semibold">{item.username || "Student"}</span>
                      <span className="text-[#667085]"> - {item.current_streak} day streak</span>
                    </li>
                  ))}
                  {!loading && topStreakRows.length === 0 ? (
                    <li className="text-xs text-[#667085]">No streak data yet.</li>
                  ) : null}
                </ol>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Top Languages</h3>
                <span className="text-xs text-[#667085]">From repo analytics</span>
              </div>
              <div className="space-y-2">
                {languageRows.slice(0, 6).map((lang) => (
                  <div key={lang.label} className="flex items-center justify-between rounded-xl border border-[#e4e7ec] px-3 py-2 text-sm">
                    <span>{lang.label}</span>
                    <strong>{lang.count}</strong>
                  </div>
                ))}
                {!loading && languageRows.length === 0 ? <p className="text-xs text-[#667085]">No language metrics yet.</p> : null}
              </div>
            </article>

            <article className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Gamification Overview</h3>
                <span className="text-xs text-[#667085]">Top 10 leaderboard</span>
              </div>
              <ol className="space-y-2 pl-5">
                {topStudents.map((student) => (
                  <li key={student.id} className="text-sm">
                    <span className="font-semibold">{student.display_name || student.username}</span>
                      <span className="text-[#667085]"> | {student.xp} XP</span>
                  </li>
                ))}
                {!loading && topStudents.length === 0 ? (
                  <li className="text-xs text-[#667085]">No leaderboard entries yet.</li>
                ) : null}
              </ol>
            </article>
          </section>
      </div>
    </AdminFrame>
  )
}




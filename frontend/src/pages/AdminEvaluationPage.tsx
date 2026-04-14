import { useEffect, useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import AdminFrame from "../components/AdminFrame"
import {
  fetchAdminEvaluationMetrics,
  fetchLoginTrends,
  fetchResearchAnalytics,
  getStoredAdminAuth,
  signOutAdmin,
} from "../lib/api"
import type { AdminEvaluationMetrics, LoginActivityTrends, ResearchAnalytics } from "../types"

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </article>
  )
}

export default function AdminEvaluationPage() {
  const auth = getStoredAdminAuth()
  const [evaluation, setEvaluation] = useState<AdminEvaluationMetrics | null>(null)
  const [research, setResearch] = useState<ResearchAnalytics | null>(null)
  const [trends, setTrends] = useState<LoginActivityTrends | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return
    setLoading(true)
    Promise.all([
      fetchAdminEvaluationMetrics(auth.token),
      fetchResearchAnalytics(auth.token),
      fetchLoginTrends(auth.token),
    ])
      .then(([evaluationPayload, researchPayload, trendsPayload]) => {
        setEvaluation(evaluationPayload)
        setResearch(researchPayload)
        setTrends(trendsPayload)
        setError("")
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load evaluation analytics."
        setError(message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403")) return
    signOutAdmin("/admin-login")
  }, [error])

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Evaluation</p>
        <h2 className="text-3xl font-semibold">SUS & AI Metrics</h2>

        {loading ? <p className="mt-6 text-sm text-ink/60">Loading metrics...</p> : null}
        {!loading && error ? <p className="mt-6 text-sm text-rose-600">{error}</p> : null}

        {!loading && !error ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Avg SUS" value={`${evaluation?.avg_sus ?? 0}`} />
              <Metric label="Students With SUS" value={`${evaluation?.students_with_sus ?? 0}`} />
              <Metric label="Portfolio Completeness" value={`${evaluation?.portfolio_completeness_rate ?? 0}%`} />
              <Metric label="Recommendation Acceptance" value={`${evaluation?.recommendation_acceptance_rate ?? 0}%`} />
              <Metric label="Recommendation Relevance" value={`${evaluation?.recommendation_relevance_rate ?? 0}%`} />
              <Metric label="Recommendation Ratings" value={`${evaluation?.recommendation_ratings_total ?? 0}`} />
              <Metric label="Career Confidence Responses" value={`${evaluation?.career_confidence_responses ?? 0}`} />
              <Metric label="Career Confidence (Pre)" value={`${evaluation?.career_confidence_pre_avg ?? 0}`} />
              <Metric label="Career Confidence (Post)" value={`${evaluation?.career_confidence_post_avg ?? 0}`} />
              <Metric label="Confidence Delta" value={`${evaluation?.career_confidence_delta ?? 0}`} />
              <Metric label="Pre/Post Pairs" value={`${evaluation?.career_confidence_pairs ?? 0}`} />
              <Metric label="P-Value (approx)" value={`${(evaluation?.career_confidence_p_value ?? 1).toFixed(4)}`} />
              <Metric
                label="Statistically Significant"
                value={evaluation?.career_confidence_significant ? "Yes (p<0.05)" : "No"}
              />
              <Metric label="Weekly Login Frequency" value={`${research?.weekly_login_frequency ?? 0}`} />
              <Metric label="Weekly Portfolio Update Freq" value={`${research?.weekly_portfolio_update_frequency ?? 0}`} />
            </div>

            <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Weekly Active Students Trend</h3>
                <span className="text-xs text-ink/50">From login analytics</span>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends?.weekly_active || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
                    <XAxis dataKey="week_start" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => [`${value}`, "Active students"]} />
                    <Line dataKey="active_users" type="monotone" stroke="#3ea2e3" strokeWidth={3} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminFrame>
  )
}

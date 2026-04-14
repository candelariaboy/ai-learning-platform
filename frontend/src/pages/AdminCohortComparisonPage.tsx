import { useEffect, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import { fetchCohortComparison, getStoredAdminAuth, signOutAdmin } from "../lib/api"
import type { CohortComparison } from "../types"

function CohortTable({
  title,
  rows,
}: {
  title: string
  rows: CohortComparison["by_program"]
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-white/80 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="mt-3 text-sm text-ink/60">No data yet.</p> : null}
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.cohort} className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <strong>{row.cohort}</strong>
              <span>{row.student_count} students</span>
            </div>
            <p className="text-xs text-ink/60">
              Avg XP {row.avg_xp} • Avg Level {row.avg_level} • Avg Repos {row.avg_repo_count}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function AdminCohortComparisonPage() {
  const auth = getStoredAdminAuth()
  const [data, setData] = useState<CohortComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return
    setLoading(true)
    fetchCohortComparison(auth.token)
      .then((payload) => {
        setData(payload)
        setError("")
      })
      .catch((err) => {
        setData(null)
        const message = err instanceof Error ? err.message : "Failed to load cohort comparison."
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
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Analytics</p>
        <h2 className="text-3xl font-semibold">Cohort Comparison</h2>

        {loading ? <p className="mt-6 text-sm text-ink/60">Loading cohort analytics...</p> : null}
        {!loading && error ? <p className="mt-6 text-sm text-rose-600">{error}</p> : null}
        {!loading && !error ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <CohortTable title="By Program" rows={data?.by_program || []} />
            <CohortTable title="By Year Level" rows={data?.by_year_level || []} />
          </div>
        ) : null}
      </div>
    </AdminFrame>
  )
}

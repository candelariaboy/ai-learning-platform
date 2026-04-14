import { useEffect, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import { fetchInterventionAlerts, getStoredAdminAuth, signOutAdmin } from "../lib/api"
import type { InterventionAlert } from "../types"

export default function AdminInterventionAlertsPage() {
  const auth = getStoredAdminAuth()
  const [rows, setRows] = useState<InterventionAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return
    setLoading(true)
    fetchInterventionAlerts(auth.token)
      .then((data) => {
        setRows(data || [])
        setError("")
      })
      .catch((err) => {
        setRows([])
        const message = err instanceof Error ? err.message : "Failed to load intervention alerts."
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
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Interventions</p>
        <h2 className="text-3xl font-semibold">Intervention Alerts</h2>

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white/80 p-4">
          {loading ? <p className="text-sm text-ink/60">Loading alerts...</p> : null}
          {!loading && error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="text-sm text-ink/60">No high-risk intervention alerts right now.</p>
          ) : null}

          <div className="space-y-3">
            {rows.map((row) => (
              <article key={row.student_id} className="rounded-xl border border-ink/10 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">@{row.username}</p>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    Risk {row.risk_score}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.reasons.map((reason, index) => (
                    <span key={`${row.student_id}-${index}`} className="rounded-full border border-ink/10 px-2 py-1 text-xs text-ink/70">
                      {reason}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink/70">{row.suggested_action}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </AdminFrame>
  )
}

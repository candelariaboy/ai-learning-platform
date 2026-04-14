import { useEffect, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import { fetchAdminStudents, fetchInterventionAlerts, getStoredAdminAuth, signOutAdmin } from "../lib/api"

export default function FacultyDashboardPage() {
  const auth = getStoredAdminAuth()
  const [studentCount, setStudentCount] = useState(0)
  const [riskCount, setRiskCount] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return
    Promise.all([fetchAdminStudents(auth.token), fetchInterventionAlerts(auth.token)])
      .then(([students, alerts]) => {
        setStudentCount(Array.isArray(students) ? students.length : 0)
        setRiskCount(Array.isArray(alerts) ? alerts.length : 0)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load faculty dashboard.")
      })
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403")) return
    signOutAdmin("/faculty-login")
  }, [error])

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Faculty</p>
        <h2 className="text-3xl font-semibold">Faculty Advisory Dashboard</h2>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-xs text-ink/50">Students monitored</p>
            <p className="mt-1 text-3xl font-bold">{studentCount}</p>
          </article>
          <article className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-xs text-ink/50">High-risk intervention alerts</p>
            <p className="mt-1 text-3xl font-bold">{riskCount}</p>
          </article>
        </div>
        <p className="mt-5 text-sm text-ink/70">
          Faculty view focuses on student advising, alerts, and evaluation insights. Use sidebar links for details.
        </p>
      </div>
    </AdminFrame>
  )
}

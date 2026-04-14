import { useEffect, useMemo, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import {
  fetchAdminStudents,
  fetchAllProjectValidations,
  getStoredAdminAuth,
  signOutAdmin,
} from "../lib/api"
import type { AdminStudentSummary, ProjectValidation } from "../types"

export default function AdminValidationsPage() {
  const auth = getStoredAdminAuth()
  const [rows, setRows] = useState<ProjectValidation[]>([])
  const [students, setStudents] = useState<AdminStudentSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  useEffect(() => {
    if (!auth.token) return
    setLoading(true)
    Promise.all([fetchAllProjectValidations(auth.token), fetchAdminStudents(auth.token)])
      .then(([validationsPayload, studentsPayload]) => {
        setRows(validationsPayload || [])
        setStudents(studentsPayload || [])
        setError("")
      })
      .catch((err) => {
        setRows([])
        const message = err instanceof Error ? err.message : "Failed to load project validations."
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403")) return
    signOutAdmin("/admin-login")
  }, [error])

  const studentMap = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  )
  const filteredRows = useMemo(
    () => (statusFilter === "ALL" ? rows : rows.filter((row) => row.status === statusFilter)),
    [rows, statusFilter]
  )

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Validations</p>
            <h2 className="text-3xl font-semibold">Project Validation</h2>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-ink/20 px-3 py-2 text-xs"
          >
            <option value="ALL">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white/80 p-4">
          {loading ? <p className="text-sm text-ink/60">Loading validations...</p> : null}
          {!loading && error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && !error && filteredRows.length === 0 ? (
            <p className="text-sm text-ink/60">No validation records yet.</p>
          ) : null}

          <div className="space-y-2">
            {filteredRows.map((row) => {
              const student = studentMap.get(row.student_id)
              return (
                <article key={row.id} className="rounded-xl border border-ink/10 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{row.repo_name}</p>
                    <span className="rounded-full border border-ink/15 px-2 py-1 text-xs uppercase">{row.status}</span>
                  </div>
                  <p className="text-xs text-ink/60">
                    {student ? `${student.display_name || student.username} (@${student.username})` : `Student #${row.student_id}`}
                  </p>
                  {row.comment ? <p className="mt-1 text-xs text-ink/70">{row.comment}</p> : null}
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </AdminFrame>
  )
}

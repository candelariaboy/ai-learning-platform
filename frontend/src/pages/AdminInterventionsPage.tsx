import { useEffect, useMemo, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import {
  createIntervention,
  fetchAdminStudents,
  fetchAllInterventions,
  getStoredAdminAuth,
  signOutAdmin,
} from "../lib/api"
import type { AdminStudentSummary, InterventionPlan } from "../types"

function resolveProgram(student: AdminStudentSummary) {
  return (student.program || "").trim() || "Unknown Program"
}

function resolveYearLevel(student: AdminStudentSummary) {
  return (student.year_level || "").trim() || "Unknown Year"
}

export default function AdminInterventionsPage() {
  const auth = getStoredAdminAuth()
  const [students, setStudents] = useState<AdminStudentSummary[]>([])
  const [rows, setRows] = useState<InterventionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [studentId, setStudentId] = useState("")
  const [programFilter, setProgramFilter] = useState("ALL")
  const [yearFilter, setYearFilter] = useState("ALL")
  const [title, setTitle] = useState("")
  const [actionPlan, setActionPlan] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [targetDate, setTargetDate] = useState("")

  const studentById = useMemo(
    () => new Map(students.map((item) => [String(item.id), item])),
    [students]
  )

  const programOptions = useMemo(() => {
    const unique = Array.from(new Set(students.map((student) => resolveProgram(student))))
    return ["ALL", ...unique]
  }, [students])

  const yearOptions = useMemo(() => {
    const unique = Array.from(new Set(students.map((student) => resolveYearLevel(student))))
    return ["ALL", ...unique]
  }, [students])

  const filteredStudents = useMemo(
    () =>
      students
        .filter((student) => (programFilter === "ALL" ? true : resolveProgram(student) === programFilter))
        .filter((student) => (yearFilter === "ALL" ? true : resolveYearLevel(student) === yearFilter))
        .sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username)),
    [students, programFilter, yearFilter]
  )

  const loadPage = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      const [studentsPayload, interventionsPayload] = await Promise.all([
        fetchAdminStudents(auth.token),
        fetchAllInterventions(auth.token),
      ])
      setStudents(studentsPayload || [])
      setRows(interventionsPayload || [])
      setError("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load intervention plans."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403")) return
    signOutAdmin("/admin-login")
  }, [error])

  useEffect(() => {
    if (!studentId) return
    if (!filteredStudents.some((student) => String(student.id) === studentId)) {
      setStudentId("")
    }
  }, [filteredStudents, studentId])

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Interventions</p>
        <h2 className="text-3xl font-semibold">Intervention Plans</h2>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-ink/10 bg-white/80 p-4">
            <h3 className="text-sm font-semibold">Create Plan</h3>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={programFilter}
                  onChange={(event) => setProgramFilter(event.target.value)}
                  className="rounded-lg border border-ink/20 px-2 py-2 text-sm"
                >
                  {programOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All Programs" : option}
                    </option>
                  ))}
                </select>
                <select
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                  className="rounded-lg border border-ink/20 px-2 py-2 text-sm"
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All Year Levels" : option}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="w-full rounded-lg border border-ink/20 px-2 py-2 text-sm"
              >
                <option value="">Select student</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={String(student.id)}>
                    {(student.display_name || student.username) +
                      ` (@${student.username}) - ${resolveProgram(student)} - ${resolveYearLevel(student)}`}
                  </option>
                ))}
              </select>
              {filteredStudents.length === 0 ? (
                <p className="text-xs text-ink/60">No students match the selected program/year level.</p>
              ) : null}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Intervention title"
                className="w-full rounded-lg border border-ink/20 px-2 py-2 text-sm"
              />
              <textarea
                value={actionPlan}
                onChange={(event) => setActionPlan(event.target.value)}
                placeholder="Action plan details"
                className="w-full rounded-lg border border-ink/20 px-2 py-2 text-sm"
                rows={4}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="rounded-lg border border-ink/20 px-2 py-2 text-sm"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                  className="rounded-lg border border-ink/20 px-2 py-2 text-sm"
                />
              </div>
              <button
                className="w-full rounded-lg border border-ink/20 px-3 py-2 text-xs font-semibold"
                disabled={busy || !studentId || !title.trim() || !actionPlan.trim()}
                onClick={async () => {
                  if (!auth.token || !studentId || !title.trim() || !actionPlan.trim()) return
                  setBusy(true)
                  try {
                    await createIntervention(auth.token, {
                      student_id: Number(studentId),
                      title: title.trim(),
                      action_plan: actionPlan.trim(),
                      priority,
                      target_date: targetDate || undefined,
                    })
                    setTitle("")
                    setActionPlan("")
                    setTargetDate("")
                    await loadPage()
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Save Intervention Plan
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white/80 p-4">
            <h3 className="text-sm font-semibold">Recent Plans</h3>
            {loading ? <p className="mt-3 text-sm text-ink/60">Loading plans...</p> : null}
            {!loading && error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            {!loading && !error && rows.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">No intervention plans yet.</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {rows.map((row) => {
                const student = studentById.get(String(row.student_id))
                return (
                  <article key={row.id} className="rounded-xl border border-ink/10 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{row.title}</p>
                      <span className="rounded-full border border-ink/15 px-2 py-1 text-xs">{row.priority}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60">
                      {student
                        ? `${student.display_name || student.username} (@${student.username}) - ${resolveProgram(student)} - ${resolveYearLevel(student)}`
                        : `Student #${row.student_id}`}{" "}
                      - {row.status}
                    </p>
                    <p className="mt-1 text-xs text-ink/70">{row.action_plan}</p>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </AdminFrame>
  )
}


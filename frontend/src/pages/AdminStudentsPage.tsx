import { useEffect, useMemo, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import {
  createAdminNote,
  createIntervention,
  deleteAdminStudent,
  deleteAllAdminStudents,
  exportAdminStudentsCsv,
  fetchAdminStudentDetails,
  fetchAdminStudents,
  getStoredAdminAuth,
  verifyAdminStudent,
} from "../lib/api"
import type { AdminStudentDetail, AdminStudentSummary } from "../types"

type YearGroup = { year: string; students: AdminStudentSummary[] }
type ProgramGroup = { program: string; students: AdminStudentSummary[]; years: YearGroup[] }

const resolveProgram = (s: AdminStudentSummary) => (s.program || "").trim() || "Unassigned Program"
const resolveYear = (s: AdminStudentSummary) => (s.year_level || "").trim() || "Unassigned Year"
const resolveName = (s: AdminStudentSummary) => s.display_name?.trim() || s.username
const formatDate = (raw?: string | null) => (raw ? new Date(raw).toLocaleString() : "-")

function formatLastSeen(raw?: string | null) {
  if (!raw) return "No activity yet"
  const ms = Date.now() - new Date(raw).getTime()
  const mins = Math.max(1, Math.floor(ms / 60000))
  if (mins < 60) return `Active ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Active ${hrs}h ago`
  return `Active ${Math.floor(hrs / 24)}d ago`
}

export default function AdminStudentsPage() {
  const auth = getStoredAdminAuth()
  const [students, setStudents] = useState<AdminStudentSummary[]>([])
  const [query, setQuery] = useState("")
  const [yearFilter, setYearFilter] = useState("ALL")
  const [collapsedPrograms, setCollapsedPrograms] = useState<Record<string, boolean>>({})
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const [openStudentId, setOpenStudentId] = useState<number | null>(null)
  const [details, setDetails] = useState<AdminStudentDetail | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [note, setNote] = useState("")
  const [ivTitle, setIvTitle] = useState("")
  const [ivPlan, setIvPlan] = useState("")
  const [ivPriority, setIvPriority] = useState("Medium")
  const [ivDate, setIvDate] = useState("")

  const loadStudents = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      setStudents((await fetchAdminStudents(auth.token)) || [])
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students.")
    } finally {
      setLoading(false)
    }
  }

  const loadDetails = async (studentId: number) => {
    if (!auth.token) return
    setDetailsLoading(true)
    try {
      setDetails((await fetchAdminStudentDetails(auth.token, studentId)) || null)
      setDetailsError("")
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to load details.")
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  const yearOptions = useMemo(() => ["ALL", ...Array.from(new Set(students.map(resolveYear))).sort()], [students])

  const filteredStudents = useMemo(() => {
    const term = query.trim().toLowerCase()
    return students
      .filter((s) => (yearFilter === "ALL" ? true : resolveYear(s) === yearFilter))
      .filter((s) => !term || resolveName(s).toLowerCase().includes(term) || s.username.toLowerCase().includes(term))
      .sort((a, b) => resolveName(a).localeCompare(resolveName(b)))
  }, [students, yearFilter, query])

  const groups = useMemo<ProgramGroup[]>(() => {
    const byProgram = new Map<string, AdminStudentSummary[]>()
    filteredStudents.forEach((s) => byProgram.set(resolveProgram(s), [...(byProgram.get(resolveProgram(s)) || []), s]))
    return Array.from(byProgram.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([program, list]) => {
        const byYear = new Map<string, AdminStudentSummary[]>()
        list.forEach((s) => byYear.set(resolveYear(s), [...(byYear.get(resolveYear(s)) || []), s]))
        const years = Array.from(byYear.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([year, studentsInYear]) => ({ year, students: studentsInYear }))
        return { program, students: list, years }
      })
  }, [filteredStudents])

  const openSummary = students.find((s) => s.id === openStudentId) || details?.student || null

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7f72a3]">Students</p>
            <h2 className="text-4xl font-semibold text-[#2d2752]">Student Directory</h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || loading}
              onClick={async () => {
                if (!auth.token) return
                setBusy(true)
                try {
                  const { blob, filename } = await exportAdminStudentsCsv(auth.token)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = filename
                  a.click()
                  URL.revokeObjectURL(url)
                } finally {
                  setBusy(false)
                }
              }}
              className="rounded-full border border-violet-200 bg-white px-5 py-2 text-sm font-semibold text-[#5e4c85]"
            >
              Export CSV
            </button>
            <button
              type="button"
              disabled={busy || loading || students.length === 0}
              onClick={async () => {
                if (!auth.token) return
                const confirmation = window.prompt('Type "DELETE_ALL_STUDENTS" to confirm bulk delete:')
                if (confirmation !== "DELETE_ALL_STUDENTS") return
                setBusy(true)
                try {
                  await deleteAllAdminStudents(auth.token, confirmation)
                  await loadStudents()
                  setOpenStudentId(null)
                  setDetails(null)
                } finally {
                  setBusy(false)
                }
              }}
              className="rounded-full bg-[#ef4b78] px-5 py-2 text-sm font-semibold text-white"
            >
              Delete All Students
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-violet-100 bg-[#f6f1ff] p-4">
          <div className="grid gap-2 rounded-2xl border border-violet-100 bg-white p-3 md:grid-cols-[1fr_170px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or username"
              className="rounded-xl border border-violet-100 px-3 py-2 text-sm outline-none"
            />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-xl border border-violet-100 px-3 py-2 text-sm outline-none"
            >
              {yearOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "ALL" ? "All Year Levels" : opt}
                </option>
              ))}
            </select>
          </div>

          {loading ? <p className="mt-4 text-sm text-[#695d8f]">Loading students...</p> : null}
          {!loading && error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

          <div className="mt-4 space-y-4">
            {groups.map((group) => {
              const pCollapsed = !!collapsedPrograms[group.program]
              return (
                <section key={group.program} className="rounded-3xl border border-violet-100 bg-white p-4">
                  <div className="flex items-center justify-between rounded-2xl border-l-4 border-violet-300 bg-[#faf7ff] px-4 py-3">
                    <div>
                      <h3 className="text-2xl font-semibold">{group.program}</h3>
                      <p className="text-sm text-[#6f6495]">{group.students.length} students</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCollapsedPrograms((c) => ({ ...c, [group.program]: !pCollapsed }))}
                      className="text-sm font-semibold text-[#5d4f86]"
                    >
                      {pCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>

                  {!pCollapsed ? (
                    <div className="mt-4 space-y-3">
                      {group.years.map((yearGroup) => {
                        const yKey = `${group.program}::${yearGroup.year}`
                        const yCollapsed = !!collapsedYears[yKey]
                        return (
                          <div key={yKey} className="rounded-2xl border border-violet-100 bg-[#fcfbff] p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-semibold text-[#514279]">{yearGroup.year}</p>
                              <button
                                type="button"
                                onClick={() => setCollapsedYears((c) => ({ ...c, [yKey]: !yCollapsed }))}
                                className="text-sm font-semibold text-[#5d4f86]"
                              >
                                ({yearGroup.students.length}) - {yCollapsed ? "Expand" : "Collapse"}
                              </button>
                            </div>
                            {!yCollapsed ? (
                              <div className="space-y-2">
                                {yearGroup.students.map((student) => (
                                  <article
                                    key={student.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white px-3 py-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-lg font-semibold text-[#2d2752]">{resolveName(student)}</p>
                                      <p className="truncate text-sm text-[#6f6495]">
                                        @{student.username} - {formatLastSeen(student.last_seen)}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <span className="rounded-full border border-violet-200 px-3 py-1">L{student.level}</span>
                                      <span className="rounded-full border border-violet-200 px-3 py-1">{student.repo_count} repos</span>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={async () => {
                                          if (!auth.token) return
                                          setBusy(true)
                                          try {
                                            await verifyAdminStudent(auth.token, {
                                              student_id: student.id,
                                              is_verified: !student.is_verified,
                                            })
                                            setStudents((c) =>
                                              c.map((it) => (it.id === student.id ? { ...it, is_verified: !it.is_verified } : it))
                                            )
                                          } finally {
                                            setBusy(false)
                                          }
                                        }}
                                        className={`rounded-full border px-3 py-1 font-semibold ${
                                          student.is_verified ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"
                                        }`}
                                      >
                                        {student.is_verified ? "Verified" : "Unverified"}
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-full border border-violet-200 px-3 py-1 font-semibold text-[#5e4c85]"
                                        onClick={async () => {
                                          setOpenStudentId(student.id)
                                          setDetails(null)
                                          await loadDetails(student.id)
                                        }}
                                      >
                                        View Details
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={async () => {
                                          if (!auth.token || !window.confirm(`Delete @${student.username}?`)) return
                                          setBusy(true)
                                          try {
                                            await deleteAdminStudent(auth.token, student.id)
                                            setStudents((c) => c.filter((it) => it.id !== student.id))
                                          } finally {
                                            setBusy(false)
                                          }
                                        }}
                                        className="rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        </div>
      </div>

      {openStudentId ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <aside className="h-full w-full max-w-[700px] overflow-y-auto bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8678af]">Student Details</p>
                <h3 className="text-2xl font-semibold text-[#2e2550]">{openSummary ? resolveName(openSummary) : "Student"}</h3>
                {openSummary ? <p className="text-sm text-[#6c6190]">@{openSummary.username}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenStudentId(null)
                  setDetails(null)
                }}
                className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-semibold text-[#5f5086]"
              >
                Close
              </button>
            </div>

            {detailsLoading ? <p className="mt-4 text-sm text-[#6c6190]">Loading details...</p> : null}
            {!detailsLoading && detailsError ? <p className="mt-4 text-sm text-rose-600">{detailsError}</p> : null}

            {!detailsLoading && details ? (
              <div className="mt-4 space-y-4">
                <section className="rounded-2xl border border-violet-100 bg-[#faf8ff] p-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-violet-100 bg-white p-3">
                      <p className="text-xs text-[#8b80aa]">Completeness</p>
                      <p className="text-xl font-semibold">{details.overview.portfolio_completeness}%</p>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-white p-3">
                      <p className="text-xs text-[#8b80aa]">Reco Acceptance</p>
                      <p className="text-xl font-semibold">{details.overview.recommendation_acceptance_rate}%</p>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-white p-3">
                      <p className="text-xs text-[#8b80aa]">SUS Avg</p>
                      <p className="text-xl font-semibold">{details.overview.sus_average ?? "-"}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-[#3d3164]">Profile</h4>
                  <p className="mt-1 text-sm text-[#6c6190]">ID: {details.profile.student_id || "-"}</p>
                  <p className="text-sm text-[#6c6190]">Career: {details.profile.career_interest || "-"}</p>
                  <p className="text-sm text-[#6c6190]">Learning style: {details.profile.preferred_learning_style || "-"}</p>
                  <p className="text-sm text-[#6c6190]">Target role: {details.profile.target_role || "-"}</p>
                  <p className="text-sm text-[#6c6190]">Bio: {details.profile.bio || "-"}</p>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-[#3d3164]">Top Repos / Recommendations / Activity</h4>
                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      {details.top_repos.slice(0, 5).map((repo) => (
                        <article key={repo.name} className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-2 text-xs">
                          <p className="font-semibold">{repo.name}</p>
                          <p>{repo.language || "Unknown"} - {repo.commit_count || 0} commits</p>
                        </article>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {details.recent_recommendations.slice(0, 5).map((r) => (
                        <article key={r.id} className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-2 text-xs">
                          <p className="font-semibold">{r.module_title}</p>
                          <p>{r.action} {r.rating ? `(${r.rating}/5)` : ""}</p>
                        </article>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {details.recent_activity.slice(0, 5).map((a) => (
                        <article key={a.id} className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-2 text-xs">
                          <p className="font-semibold capitalize">{a.event.replace(/_/g, " ")}</p>
                          <p>{formatDate(a.created_at)}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-[#3d3164]">Records</h4>
                  <p className="mt-1 text-sm text-[#6c6190]">
                    Certificates: {details.certificates.length} | Validations: {details.validations.length} | Reviews:{" "}
                    {details.reviews.length}
                  </p>
                  <p className="text-sm text-[#6c6190]">
                    Notes: {details.notes.length} | Interventions: {details.interventions.length}
                  </p>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-[#3d3164]">Admin Actions</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !openSummary || !auth.token}
                      onClick={async () => {
                        if (!auth.token || !openSummary) return
                        setBusy(true)
                        try {
                          await verifyAdminStudent(auth.token, {
                            student_id: openSummary.id,
                            is_verified: !openSummary.is_verified,
                          })
                          setStudents((c) =>
                            c.map((s) => (s.id === openSummary.id ? { ...s, is_verified: !s.is_verified } : s))
                          )
                          await loadDetails(openSummary.id)
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-semibold text-[#5e4d85]"
                    >
                      {openSummary?.is_verified ? "Mark Unverified" : "Mark Verified"}
                    </button>
                    <button
                      type="button"
                      disabled={!openSummary}
                      onClick={() => openSummary && window.open(`/p/${openSummary.username}`, "_blank", "noopener,noreferrer")}
                      className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-semibold text-[#5e4d85]"
                    >
                      Open Public Portfolio
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b70a0]">Add Note</p>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-violet-100 px-2 py-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        disabled={busy || !note.trim() || !openSummary || !auth.token}
                        onClick={async () => {
                          if (!auth.token || !openSummary || !note.trim()) return
                          setBusy(true)
                          try {
                            await createAdminNote(auth.token, { student_id: openSummary.id, note: note.trim() })
                            setNote("")
                            await loadDetails(openSummary.id)
                          } finally {
                            setBusy(false)
                          }
                        }}
                        className="mt-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold"
                      >
                        Save Note
                      </button>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b70a0]">Create Intervention</p>
                      <input
                        value={ivTitle}
                        onChange={(e) => setIvTitle(e.target.value)}
                        placeholder="Title"
                        className="mt-2 w-full rounded-lg border border-violet-100 px-2 py-2 text-sm outline-none"
                      />
                      <textarea
                        value={ivPlan}
                        onChange={(e) => setIvPlan(e.target.value)}
                        rows={2}
                        placeholder="Action plan"
                        className="mt-2 w-full rounded-lg border border-violet-100 px-2 py-2 text-sm outline-none"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select
                          value={ivPriority}
                          onChange={(e) => setIvPriority(e.target.value)}
                          className="rounded-lg border border-violet-100 px-2 py-2 text-sm outline-none"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                        <input
                          type="date"
                          value={ivDate}
                          onChange={(e) => setIvDate(e.target.value)}
                          className="rounded-lg border border-violet-100 px-2 py-2 text-sm outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy || !openSummary || !auth.token || !ivTitle.trim() || !ivPlan.trim()}
                        onClick={async () => {
                          if (!auth.token || !openSummary || !ivTitle.trim() || !ivPlan.trim()) return
                          setBusy(true)
                          try {
                            await createIntervention(auth.token, {
                              student_id: openSummary.id,
                              title: ivTitle.trim(),
                              action_plan: ivPlan.trim(),
                              priority: ivPriority,
                              target_date: ivDate || undefined,
                            })
                            setIvTitle("")
                            setIvPlan("")
                            setIvPriority("Medium")
                            setIvDate("")
                            await loadDetails(openSummary.id)
                          } finally {
                            setBusy(false)
                          }
                        }}
                        className="mt-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold"
                      >
                        Save Intervention
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-[#3d3164]">Recent Notes & Interventions</h4>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      {details.notes.slice(0, 5).map((n) => (
                        <article key={n.id} className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-2 text-xs">
                          <p>{n.note}</p>
                          <p>{formatDate(n.created_at)}</p>
                        </article>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {details.interventions.slice(0, 5).map((i) => (
                        <article key={i.id} className="rounded-xl border border-violet-100 bg-[#fbf9ff] p-2 text-xs">
                          <p className="font-semibold">{i.title}</p>
                          <p>{i.priority} - {i.status}</p>
                          <p>{formatDate(i.created_at)}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </AdminFrame>
  )
}

import { useEffect, useMemo, useState } from "react"
import { fetchMyProjectValidations, fetchOwnerPortfolio, getStoredAuth, submitCertificate } from "../lib/api"
import type { PortfolioResponse, ProjectValidation } from "../types"

function normalizeStatus(value: string) {
  const status = (value || "").toLowerCase()
  if (status === "verified" || status === "approved") {
    return { label: "Verified", className: "bg-[#E8F4F0] text-[#0F6E56]" }
  }
  if (status === "rejected") {
    return { label: "Rejected", className: "bg-[#FDECEC] text-[#A32D2D]" }
  }
  if (status === "in_review" || status === "review") {
    return { label: "In review", className: "bg-[#FFF4E8] text-[#BA7517]" }
  }
  return { label: "Pending", className: "bg-[#FFF4E8] text-[#BA7517]" }
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(parsed)
}

export default function ProjectValidationsPage() {
  const auth = getStoredAuth()
  const [rows, setRows] = useState<ProjectValidation[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [toast, setToast] = useState("")
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [projectTitle, setProjectTitle] = useState("")
  const [projectUrl, setProjectUrl] = useState("")
  const [projectTech, setProjectTech] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!auth.token) {
      setRows([])
      setPortfolio(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [validations, ownerPortfolio] = await Promise.all([
          fetchMyProjectValidations(auth.token),
          fetchOwnerPortfolio(auth.token),
        ])
        if (cancelled) return
        setRows(Array.isArray(validations) ? validations : [])
        setPortfolio(ownerPortfolio)
      } catch {
        if (cancelled) return
        setRows([])
        setPortfolio(null)
      }
    }
    void load()
    const intervalId = window.setInterval(load, 10000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [auth.token])

  const repoMap = useMemo(() => {
    const map = new Map<string, string>()
    ;(portfolio?.repos || []).forEach((repo) => {
      const name = (repo.name || "").trim().toLowerCase()
      if (!name) return
      const languages = Array.from(
        new Set(
          [repo.language, ...(repo.languages || [])]
            .map((item) => String(item || "").trim())
            .filter((item) => item && item.toLowerCase() !== "unknown")
        )
      )
      map.set(name, languages.length > 0 ? languages.join(", ") : "Not specified")
    })
    return map
  }, [portfolio?.repos])

  const metrics = useMemo(() => {
    const submitted = rows.length
    const verified = rows.filter((row) => normalizeStatus(row.status).label === "Verified").length
    const pending = rows.filter((row) => {
      const label = normalizeStatus(row.status).label
      return label === "Pending" || label === "In review"
    }).length
    return { submitted, verified, pending }
  }, [rows])

  const latestFacultyNote = useMemo(() => {
    const noteRow = rows.find((row) => (row.comment || "").trim().length > 0)
    if (!noteRow) return null
    return {
      note: noteRow.comment || "",
      repo: noteRow.repo_name,
      date: noteRow.created_at,
    }
  }, [rows])

  if (!auth.token) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to view your project validations.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
      {toast ? (
        <div className="fixed right-5 top-5 z-50 rounded-[12px] border border-[#DDE1EB] bg-white px-4 py-2 text-[12px] text-[#2A3145]">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Project Validations</p>
          <h1 className="text-[24px] font-medium text-[#1E2538]">Validation Status</h1>
        </div>
        <button
          type="button"
          className="rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white"
          onClick={() => setShowSubmitForm((prev) => !prev)}
        >
          Submit project
        </button>
      </div>

      {showSubmitForm ? (
        <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
          <h3 className="text-[15px] font-medium text-[#1E2538]">Submit Project Entry</h3>
          <p className="mt-1 text-[12px] text-[#6A7288]">
            This submits a review request record using the existing student submission endpoint.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
              placeholder="Project name"
            />
            <input
              value={projectTech}
              onChange={(event) => setProjectTech(event.target.value)}
              className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
              placeholder="Tech stack (optional)"
            />
            <input
              value={projectUrl}
              onChange={(event) => setProjectUrl(event.target.value)}
              className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
              placeholder="Repo URL"
            />
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              if (!auth.token) return
              if (!projectTitle.trim() || !projectUrl.trim()) {
                setToast("Project name and URL are required.")
                return
              }
              setSubmitting(true)
              try {
                await submitCertificate(auth.token, {
                  title: projectTitle.trim(),
                  provider: projectTech.trim() || "Project Repository",
                  certificate_url: projectUrl.trim(),
                })
                setProjectTitle("")
                setProjectTech("")
                setProjectUrl("")
                setShowSubmitForm(false)
                setToast("Project submission sent.")
              } catch {
                setToast("Failed to submit project entry.")
              } finally {
                setSubmitting(false)
              }
            }}
            className="mt-3 rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Send for review"}
          </button>
        </section>
      ) : null}

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Submitted</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{metrics.submitted}</p>
        </div>
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Verified</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{metrics.verified}</p>
        </div>
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Pending</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{metrics.pending}</p>
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Submissions</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E4E8F2] text-[11px] uppercase tracking-[0.06em] text-[#6D7489]">
                <th className="py-2">Project name</th>
                <th className="py-2">Date</th>
                <th className="py-2">Tech stack</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = normalizeStatus(row.status)
                const tech = repoMap.get((row.repo_name || "").trim().toLowerCase()) || "Not specified"
                return (
                  <tr key={row.id} className="border-b border-[#EEF1F7] text-[12px] text-[#2A3145]">
                    <td className="py-2.5">{row.repo_name}</td>
                    <td className="py-2.5 text-[#66708A]">{formatDate(row.created_at)}</td>
                    <td className="py-2.5 text-[#66708A]">{tech}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="py-4 text-[12px] text-[#6A7288]">No project validations yet.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Faculty Notes</h3>
        {latestFacultyNote ? (
          <div className="mt-3 rounded-[10px] border border-[#E4E8F2] p-3">
            <p className="text-[13px] text-[#2A3145]">{latestFacultyNote.note}</p>
            <p className="mt-2 text-[11px] text-[#6A7288]">
              {latestFacultyNote.repo} - {formatDate(latestFacultyNote.date)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-[#6A7288]">No faculty notes yet.</p>
        )}
      </section>
    </div>
  )
}

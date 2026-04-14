import { useEffect, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import {
  fetchPendingCertificates,
  getStoredAdminAuth,
  reviewCertificate,
  reviewCertificatesBulk,
  signOutAdmin,
} from "../lib/api"
import type { CertificateRecord } from "../types"

export default function AdminCertificatesPage() {
  const auth = getStoredAdminAuth()
  const [rows, setRows] = useState<CertificateRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [statusById, setStatusById] = useState<Record<number, string>>({})
  const [noteById, setNoteById] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  const loadRows = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      const data = await fetchPendingCertificates(auth.token)
      setRows(data || [])
      setError("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load pending certificates."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403")) return
    signOutAdmin("/admin-login")
  }, [error])

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Certificates</p>
            <h2 className="text-3xl font-semibold">Certificate Review</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-ink/10 px-3 py-1 text-xs">
              Pending: {rows.length}
            </span>
            <button
              className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
              disabled={busy || rows.length === 0}
              onClick={async () => {
                if (!auth.token || rows.length === 0) return
                setBusy(true)
                try {
                  await reviewCertificatesBulk(auth.token, {
                    items: rows.map((item) => ({ certificate_id: item.id, status: "verified" })),
                  })
                  await loadRows()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Verify All Pending
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white/80 p-4">
          {loading ? <p className="text-sm text-ink/60">Loading pending certificates...</p> : null}
          {!loading && error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="text-sm text-ink/60">No pending certificate submissions.</p>
          ) : null}

          <div className="space-y-3">
            {rows.map((item) => (
              <div key={item.id} className="rounded-xl border border-ink/10 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-ink/60">
                      {item.provider} • @{item.username || `student-${item.user_id}`}
                    </p>
                    <a
                      href={item.certificate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-700 underline"
                    >
                      Open certificate link
                    </a>
                  </div>
                  <div className="min-w-[240px] space-y-2">
                    <select
                      value={statusById[item.id] || "verified"}
                      onChange={(event) =>
                        setStatusById((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                      className="w-full rounded-lg border border-ink/20 px-2 py-2 text-xs"
                    >
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                      <option value="pending">Pending</option>
                    </select>
                    <input
                      value={noteById[item.id] || ""}
                      onChange={(event) =>
                        setNoteById((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                      placeholder="Reviewer note (optional)"
                      className="w-full rounded-lg border border-ink/20 px-2 py-2 text-xs"
                    />
                    <button
                      className="w-full rounded-lg border border-ink/20 px-2 py-2 text-xs font-semibold"
                      disabled={busy}
                      onClick={async () => {
                        if (!auth.token) return
                        setBusy(true)
                        try {
                          await reviewCertificate(auth.token, {
                            certificate_id: item.id,
                            status: statusById[item.id] || "verified",
                            reviewer_note: noteById[item.id]?.trim() || undefined,
                          })
                          await loadRows()
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      Submit Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminFrame>
  )
}

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import AdminFrame from "../components/AdminFrame"
import LeaderboardRow from "../components/LeaderboardRow"
import { fetchLeaderboard, getStoredAdminAuth } from "../lib/api"
import type { LeaderboardEntry } from "../types"

export default function LeaderboardPage() {
  const auth = getStoredAdminAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return
    fetchLeaderboard()
      .then((data) => {
        setEntries(data)
        setError("")
      })
      .catch(() => {
        setEntries([])
        setError("No leaderboard data yet.")
      })
  }, [auth.token])

  if (!auth.token) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="rounded-3xl border border-ink/10 bg-paper/80 p-8 text-center shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">404</p>
          <h1 className="mt-2 text-3xl font-semibold">Not Found</h1>
          <p className="mt-3 text-sm text-ink/70">Sign in as admin to view this page.</p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink/80"
          >
            Go home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl px-4 py-1 sm:px-6 sm:py-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Leaderboard</p>
          <h2 className="text-3xl font-semibold">Top builders this week</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
          <span className="rounded-full border border-ink/10 px-3 py-1">
            XP based
          </span>
          <span className="rounded-full border border-ink/10 px-3 py-1">
            Deterministic
          </span>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-ink/10 bg-paper/80 p-4 text-sm text-ink/70">
            {error || "No leaderboard data yet."}
          </div>
        ) : (
          entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <LeaderboardRow entry={entry} rank={index + 1} />
            </motion.div>
          ))
        )}
      </div>
      </div>
    </AdminFrame>
  )
}

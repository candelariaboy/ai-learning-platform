import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import CommitActivityChart from "../components/analytics/CommitActivityChart"
import LearningProgressChart from "../components/analytics/LearningProgressChart"
import LoginActivitySection from "../components/analytics/LoginActivitySection"
import XPGrowthChart from "../components/analytics/XPGrowthChart"
import {
  claimBadges,
  fetchActivityTimeline,
  fetchEngagementAnalytics,
  fetchLearningPath,
  fetchLoginActivity,
  fetchMyPortfolioCompleteness,
  fetchOwnerPortfolio,
  getStoredAuth,
  recomputeInsights,
  updateSettings,
} from "../lib/api"
import type {
  ActivityTimelineItem,
  EngagementAnalytics,
  LearningPathResponse,
  LoginActivity,
  PortfolioCompleteness,
  PortfolioResponse,
} from "../types"

function formatRepoUpdated(value?: string | null) {
  if (!value) return "recently"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(parsed)
}

export default function DashboardPage() {
  const [params] = useSearchParams()
  const usernameParam = (params.get("username") || "").trim()
  const auth = getStoredAuth()
  const isAuthenticated = Boolean(auth.token && auth.username)

  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [learningPath, setLearningPath] = useState<LearningPathResponse | null>(null)
  const [engagement, setEngagement] = useState<EngagementAnalytics | null>(null)
  const [timeline, setTimeline] = useState<ActivityTimelineItem[]>([])
  const [loginActivity, setLoginActivity] = useState<LoginActivity | null>(null)
  const [portfolioCompleteness, setPortfolioCompleteness] = useState<PortfolioCompleteness | null>(null)
  const [recomputeLoading, setRecomputeLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [toast, setToast] = useState("")
  const [editingFeaturedBadges, setEditingFeaturedBadges] = useState(false)
  const [featuredBadgeDraft, setFeaturedBadgeDraft] = useState<string[]>([])
  const [savingBadgeView, setSavingBadgeView] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setData(null)
      setLearningPath(null)
      setEngagement(null)
      setTimeline([])
      setLoginActivity(null)
      setPortfolioCompleteness(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [portfolio, lp, engagementRows, timelineRows, loginRows, completeness] = await Promise.all([
          fetchOwnerPortfolio(auth.token),
          fetchLearningPath(auth.username),
          fetchEngagementAnalytics(auth.token),
          fetchActivityTimeline(auth.token),
          fetchLoginActivity(auth.token),
          fetchMyPortfolioCompleteness(auth.token),
        ])
        if (cancelled) return
        setData(portfolio)
        setLearningPath(lp)
        setEngagement(engagementRows || null)
        setTimeline(timelineRows || [])
        setLoginActivity(loginRows || null)
        setPortfolioCompleteness(completeness || null)
      } catch {
        if (cancelled) return
        setData(null)
        setLearningPath(null)
        setEngagement(null)
        setTimeline([])
        setLoginActivity(null)
        setPortfolioCompleteness(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, auth.token, auth.username])

  useEffect(() => {
    if (!data) {
      setFeaturedBadgeDraft([])
      return
    }
    setFeaturedBadgeDraft(data.settings?.featured_badges || [])
  }, [data])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const privateAccessMismatch =
    Boolean(usernameParam) &&
    Boolean(auth.username) &&
    usernameParam.toLowerCase() !== auth.username.toLowerCase()

  const levelProgress = useMemo(() => {
    if (!data) return 0
    const xp = Number(data.profile.xp || 0)
    const level = Math.max(1, Number(data.profile.level || 1))
    const nextLevelXp = Math.max(1, Number(data.profile.nextLevelXp || level * 500))
    const prevLevelXp = Math.max(0, (level - 1) * 500)
    const range = Math.max(1, nextLevelXp - prevLevelXp)
    const progress = ((xp - prevLevelXp) / range) * 100
    return Math.max(0, Math.min(100, Math.round(progress)))
  }, [data])

  const totalXp = Number(data?.profile.xp || 0)

  const remainingXp = Math.max(0, Math.max(0, Number(data?.profile.nextLevelXp || 0)) - totalXp)
  const learningPathProgress = Math.max(0, Math.min(100, Number(learningPath?.progress_percent || 0)))

  const achievedBadges = (data?.badges || []).filter((badge) => badge.achieved)
  const claimableBadges = achievedBadges.filter((badge) => !badge.claimed)
  const previewBadges = [...achievedBadges].sort((a, b) => {
    if (Boolean(a.claimed) !== Boolean(b.claimed)) return a.claimed ? 1 : -1
    return a.label.localeCompare(b.label)
  })
  const shownBadgeLabels = featuredBadgeDraft.length > 0 ? featuredBadgeDraft : achievedBadges.map((badge) => badge.label)
  const shownBadges = achievedBadges.filter((badge) => shownBadgeLabels.includes(badge.label))
  const featuredRepos = (data?.repos || []).slice(0, 6)

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to open your dashboard.
        </div>
      </div>
    )
  }

  if (privateAccessMismatch) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          This dashboard is private to the signed-in account.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {toast ? (
        <div className="fixed right-5 top-5 z-50 rounded-[12px] border border-[#cad5f3] bg-white/95 px-4 py-2 text-[12px] text-[#2A3145] shadow-[0_12px_28px_rgba(23,37,84,0.15)] backdrop-blur">
          {toast}
        </div>
      ) : null}

      <section className="dp-card p-5">
        <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Dashboard</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold text-[#1E2538]">{data?.profile.displayName || auth.username}</h1>
            <p className="text-[13px] text-[#6A7288]">@{data?.profile.username || auth.username}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#e9ebff] px-3 py-1 text-[11px] font-medium text-[#3730a3]">
              Level {data?.profile.level || 1}
            </span>
            <span className="rounded-full bg-[#f1f5ff] px-3 py-1 text-[11px] text-[#49526A]">
              {data?.profile.streakDays || 0} day streak
            </span>
            {data?.focus_domain?.domain ? (
              <span className="rounded-full bg-[#ecfeff] px-3 py-1 text-[11px] text-[#155e75]">
                Focus: {data.focus_domain.domain}
              </span>
            ) : null}
            {typeof data?.frequency?.weekly_commit_average === "number" ? (
              <span className="rounded-full bg-[#f0fdf4] px-3 py-1 text-[11px] text-[#166534]">
                {data.frequency.weekly_commit_average.toFixed(1)} commits/week
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="dp-card p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold text-[#1E2538]">XP to next level</p>
          <p className="text-[12px] text-[#6A7288]">{levelProgress}%</p>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-[#e7ecfa]">
          <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,#4f46e5,#6366f1)]" style={{ width: `${levelProgress}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-[#6A7288]">
          {totalXp} XP earned - {remainingXp} XP to level up
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[14px] font-medium text-[#1E2538]">Learning Path Progress</p>
          <p className="text-[12px] text-[#6A7288]">{learningPathProgress}%</p>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-[#e7ecfa]">
          <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6)]" style={{ width: `${learningPathProgress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {["25%", "50%", "75%", "Complete"].map((milestone) => (
            <span key={milestone} className="dp-chip px-2 py-1 text-[#5D667D]">
              {milestone}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[#6A7288]">Progress updates automatically from repository signals.</p>
      </section>

      <section className="dp-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[18px] font-medium text-[#1E2538]">Portfolio Completeness</h3>
          <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-[11px] font-semibold text-[#124b80]">
            {portfolioCompleteness?.score ?? 0}%
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[#6A7288]">Clear breakdown of what is complete and what still needs work.</p>
        <div className="mt-3 space-y-2">
          {(portfolioCompleteness?.breakdown || []).map((item) => {
            const percent = item.max_score > 0 ? Math.round((item.score / item.max_score) * 100) : 0
            return (
              <div key={item.key} className="rounded-[10px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-[#2A3145]">{item.label}</p>
                  <p className="text-[11px] text-[#6A7288]">
                    {item.score}/{item.max_score}
                  </p>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#E5E8F1]">
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6)]" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
          {(portfolioCompleteness?.breakdown || []).length === 0 ? (
            <p className="text-[12px] text-[#6A7288]">No completeness breakdown available yet.</p>
          ) : null}
        </div>
      </section>

      <section className="dp-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-[#6A7288]">{shownBadges.length} achievement(s) shown</p>
          <button
            type="button"
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550]"
            onClick={() => setEditingFeaturedBadges((prev) => !prev)}
          >
            {editingFeaturedBadges ? "Done" : "Edit"}
          </button>
        </div>

        {editingFeaturedBadges ? (
          <div className="mt-3 space-y-3 rounded-[10px] border border-[#E4E8F2] p-3">
            <p className="text-[12px] text-[#6A7288]">
              Select badges to show here. If none selected, all achieved badges are shown.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {achievedBadges.map((badge) => (
                <label key={badge.label} className="flex items-center gap-2 text-[12px] text-[#374158]">
                  <input
                    type="checkbox"
                    checked={featuredBadgeDraft.includes(badge.label)}
                    onChange={(event) => {
                      setFeaturedBadgeDraft((prev) =>
                        event.target.checked ? Array.from(new Set([...prev, badge.label])) : prev.filter((item) => item !== badge.label)
                      )
                    }}
                  />
                  {badge.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingBadgeView}
                className="rounded-[8px] bg-[linear-gradient(120deg,#4f46e5,#6366f1)] px-3 py-1.5 text-[11px] text-white shadow-[0_10px_22px_rgba(79,70,229,0.32)] disabled:opacity-60"
                onClick={async () => {
                  if (!auth.token) return
                  setSavingBadgeView(true)
                  try {
                    const updated = await updateSettings(auth.token, { featured_badges: featuredBadgeDraft })
                    setData(updated)
                    setToast("Saved badge view")
                  } finally {
                    setSavingBadgeView(false)
                  }
                }}
              >
                Save badge view
              </button>
              <button
                type="button"
                disabled={savingBadgeView}
                className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550] disabled:opacity-60"
                onClick={async () => {
                  if (!auth.token) return
                  setSavingBadgeView(true)
                  try {
                    setFeaturedBadgeDraft([])
                    const updated = await updateSettings(auth.token, { featured_badges: [] })
                    setData(updated)
                    setToast("Reset (show all)")
                  } finally {
                    setSavingBadgeView(false)
                  }
                }}
              >
                Reset (show all)
              </button>
            </div>
          </div>
        ) : null}

        {shownBadges.length === 0 ? (
          <p className="mt-3 text-[12px] text-[#6A7288]">
            No achieved achievements yet. Visit Achievements and claim your next milestone.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {shownBadges.map((badge) => (
              <span key={badge.label} className="rounded-full bg-[#EEEDFE] px-2 py-1 text-[11px] text-[#3C3489]">
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dp-card p-5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">AI Insight</p>
          <h3 className="mt-1 text-[18px] font-medium text-[#1E2538]">Career suggestions</h3>
          <p className="mt-1 text-[12px] text-[#6A7288]">Updated as repositories change. Always visible with reasoning.</p>
          <div className="mt-3 space-y-3">
            {(data?.career_suggestions || []).slice().sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0)).slice(0, 3).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-[10px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
                <p className="text-[14px] font-medium text-[#2A3145]">{item.title}</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">{item.confidence}% match</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">{item.reasoning}</p>
                <p className="mt-2 text-[11px] text-[#6A7288]">Confidence</p>
                <div className="mt-1 h-2 rounded-full bg-[#E5E8F1]">
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,#4f46e5,#818cf8)]" style={{ width: `${item.confidence}%` }} />
                </div>
              </div>
            ))}
            {(data?.career_suggestions || []).length === 0 ? (
              <p className="text-[12px] text-[#6A7288]">
                No repo activity yet. Push a project or add languages to see career suggestions.
              </p>
            ) : null}
          </div>
        </article>

        <article className="dp-card p-5">
          <h3 className="text-[18px] font-medium text-[#1E2538]">AI Practice Dimensions</h3>
          <div className="mt-3 space-y-3">
            {(data?.practice_dimensions || []).map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-[10px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Practice Dimension</p>
                <p className="mt-1 text-[14px] font-medium text-[#2A3145]">{item.label}</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">{item.confidence}% confident</p>
                <p className="mt-2 text-[11px] text-[#6A7288]">Activity / project list</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(item.evidence || []).map((ev) => (
                    <span key={`${item.label}-${ev}`} className="rounded-full bg-[#F1F3FA] px-2 py-1 text-[10px] text-[#5F6680]">
                      {ev}
                    </span>
                  ))}
                  {(item.evidence || []).length === 0 ? <span className="text-[11px] text-[#6A7288]">No activity yet.</span> : null}
                </div>
              </div>
            ))}
            {(data?.practice_dimensions || []).length === 0 ? (
              <p className="text-[12px] text-[#6A7288]">
                No repo signals yet. Practice dimensions will appear once your GitHub has activity.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dp-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[18px] font-medium text-[#1E2538]">Achievements</h3>
            <button
              type="button"
              disabled={claimLoading || claimableBadges.length === 0}
              className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550] disabled:opacity-60"
              onClick={async () => {
                if (!auth.token || claimableBadges.length === 0) return
                const claimableCount = claimableBadges.length
                const xpGain = claimableBadges.reduce((sum, badge) => sum + Number(badge.reward_xp || 0), 0)
                setClaimLoading(true)
                try {
                  const updated = await claimBadges(auth.token)
                  setData((prev) => ({ ...updated, settings: prev?.settings || {} }))
                  setToast(`Celebration: Claimed ${claimableCount} achievement(s)! +${xpGain} XP`)
                } finally {
                  setClaimLoading(false)
                }
              }}
            >
              {claimLoading ? "Claiming..." : "Claim available"}
            </button>
          </div>
          {(data?.badges || []).filter((badge) => badge.claimed).length === 0 ? (
            <p className="mt-3 text-[12px] text-[#6A7288]">
              No claimed achievements yet. Claim available achievements in the Achievements page.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {previewBadges.slice(0, 3).map((badge) => (
                <span key={badge.label} className="rounded-full bg-[#EEEDFE] px-2 py-1 text-[11px] text-[#3C3489]">
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className="dp-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[18px] font-medium text-[#1E2538]">Featured Repos</h3>
            <button
              type="button"
              disabled={recomputeLoading}
              className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550] disabled:opacity-60"
              onClick={async () => {
                if (!auth.token) return
                setRecomputeLoading(true)
                try {
                  const updated = await recomputeInsights(auth.token)
                  setData((prev) => ({ ...updated, settings: prev?.settings || {} }))
                } finally {
                  setRecomputeLoading(false)
                }
              }}
            >
              {recomputeLoading ? "Recomputing..." : "Recompute"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {featuredRepos.map((repo) => (
              <article key={repo.name} className="rounded-[10px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6A7288]">{repo.language || "Unknown"}</span>
                  <span className="text-[11px] text-[#6A7288]">{formatRepoUpdated(repo.lastUpdated || repo.last_push)}</span>
                </div>
                <p className="mt-1 text-[13px] font-medium text-[#2A3145]">{repo.name}</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">{repo.description || "No description."}</p>
                <p className="mt-1 text-[11px] text-[#6A7288]">Stars: {repo.stars}</p>
              </article>
            ))}
            {featuredRepos.length === 0 ? <p className="text-[12px] text-[#6A7288]">No repositories found.</p> : null}
          </div>
        </article>
      </section>

      {engagement ? (
        <section className="dp-card p-5">
          <h3 className="text-[18px] font-medium text-[#1E2538]">Engagement Trends</h3>
          <div className="mt-3 rounded-[10px] border border-[#E4E8F2] p-3">
            <p className="text-[14px] font-medium text-[#2A3145]">Activity Timeline</p>
            {timeline.length === 0 ? (
              <p className="mt-2 text-[12px] text-[#6A7288]">No activity yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {timeline.slice(0, 6).map((item, index) => (
                  <div key={`${item.date}-${index}`} className="flex items-center justify-between rounded-[8px] bg-[#F5F7FC] px-2 py-1.5 text-[12px] text-[#55607A]">
                    <span>{item.event}</span>
                    <span>{String(item.date || "").slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <CommitActivityChart data={engagement.weekly_commits} />
            <XPGrowthChart data={engagement.xp_growth} />
            <LearningProgressChart data={engagement.learning_progress} />
          </div>
        </section>
      ) : null}

      {loginActivity ? <LoginActivitySection data={loginActivity} /> : null}
    </div>
  )
}

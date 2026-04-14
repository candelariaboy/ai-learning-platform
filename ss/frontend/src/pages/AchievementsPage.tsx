import { useEffect, useMemo, useState } from "react"
import { claimBadges, fetchOwnerPortfolio, getStoredAuth } from "../lib/api"
import type { PortfolioResponse } from "../types"

export default function AchievementsPage() {
  const auth = getStoredAuth()
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [toast, setToast] = useState("")

  useEffect(() => {
    if (!auth.token) {
      setData(null)
      return
    }
    let cancelled = false
    fetchOwnerPortfolio(auth.token)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
      })
      .catch(() => {
        if (cancelled) return
        setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [auth.token])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const badges = data?.badges || []
  const claimableBadges = badges.filter((badge) => badge.achieved && !badge.claimed)
  const claimableCount = claimableBadges.length
  const claimableXpGain = useMemo(
    () => claimableBadges.reduce((sum, badge) => sum + Number(badge.reward_xp || 0), 0),
    [claimableBadges]
  )

  if (!auth.token) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to view achievements.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {toast ? (
        <div className="fixed right-5 top-5 z-50 rounded-[12px] border border-[#DDE1EB] bg-white px-4 py-2 text-[12px] text-[#2A3145]">
          {toast}
        </div>
      ) : null}

      <section className="rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Achievements</p>
            <h1 className="text-[24px] font-medium text-[#1E2538]">All achievements</h1>
          </div>
          <button
            type="button"
            disabled={claiming || claimableCount === 0}
            className="rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
            onClick={async () => {
              if (!auth.token || claimableCount === 0) return
              setClaiming(true)
              try {
                const updated = await claimBadges(auth.token)
                setData((prev) => ({ ...updated, settings: prev?.settings || {} }))
                setToast(`Celebration: Claimed ${claimableCount} achievement(s)! +${claimableXpGain} XP`)
              } finally {
                setClaiming(false)
              }
            }}
          >
            {claiming ? "Claiming..." : "Claim available"}
          </button>
        </div>
      </section>

      <section className="rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        {badges.length === 0 ? (
          <p className="text-[12px] text-[#6A7288]">
            No achievements yet. Keep building - the first badge lands fast with consistent commits.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {badges.map((badge) => (
              <article key={badge.label} className="rounded-[10px] border border-[#E4E8F2] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]" aria-hidden>{badge.medal_icon || badge.icon || "🏅"}</span>
                    <p className="text-[14px] font-medium text-[#2A3145]">{badge.label}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {badge.achieved ? (
                      <span className="rounded-full bg-[#EEEDFE] px-2 py-0.5 text-[10px] text-[#3C3489]">
                        {badge.claimed ? "Claimed" : "Achieved"}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[#F1F3FA] px-2 py-0.5 text-[10px] text-[#5F6680]">{badge.rarity}</span>
                  </div>
                </div>

                {badge.achieved && !badge.claimed ? (
                  <button
                    type="button"
                    disabled={claiming}
                    className="mt-2 rounded-[8px] border border-[#D1D6E3] px-3 py-1 text-[11px] text-[#2E3550] disabled:opacity-60"
                    onClick={async () => {
                      if (!auth.token) return
                      const currentClaimable = badges.filter((item) => item.achieved && !item.claimed)
                      const gain = currentClaimable.reduce((sum, item) => sum + Number(item.reward_xp || 0), 0)
                      setClaiming(true)
                      try {
                        const updated = await claimBadges(auth.token)
                        setData((prev) => ({ ...updated, settings: prev?.settings || {} }))
                        setToast(`Celebration: Claimed ${currentClaimable.length} achievement(s)! +${gain} XP`)
                      } finally {
                        setClaiming(false)
                      }
                    }}
                  >
                    Claim
                  </button>
                ) : null}

                <p className="mt-2 text-[12px] text-[#6A7288]">{badge.description}</p>
                <p className="mt-2 text-[12px] font-medium text-[#5A36B3]">Reward: +{badge.reward_xp || 0} XP</p>
                <p className="mt-1 text-[11px] text-[#6A7288]">Criteria: {badge.criteria}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

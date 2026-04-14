import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import PortfolioPreview from "../components/PortfolioPreview"
import { badges as mockBadges, featuredRepos as mockRepos, profile as mockProfile } from "../data/mock"
import { fetchReviewPortfolio } from "../lib/api"
import type { PortfolioResponse } from "../types"

export default function ReviewPortfolioPage() {
  const { token } = useParams()
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return
    fetchReviewPortfolio(token)
      .then((payload) => {
        setData(payload)
        setError("")
      })
      .catch(() => {
        setData(null)
        setError("Invalid or expired review link.")
      })
  }, [token])

  const effectivePreviewDark =
    typeof data?.settings?.show_sections?.preview_dark === "boolean"
      ? data.settings.show_sections.preview_dark
      : false
  const effectiveThemeLight = data?.settings?.theme_light || data?.settings?.theme || "aurora"
  const effectiveThemeDark = data?.settings?.theme_dark || data?.settings?.theme || "aurora"
  const activeTheme = effectivePreviewDark ? effectiveThemeDark : effectiveThemeLight

  const themedClass = useMemo(() => {
    if (effectivePreviewDark) {
      if (activeTheme === "sunset") return "bg-gradient-to-br from-rose-950 via-orange-950 to-amber-950"
      if (activeTheme === "ocean") return "bg-gradient-to-br from-sky-950 via-cyan-950 to-blue-950"
      return "bg-gradient-to-br from-indigo-950 via-slate-950 to-emerald-950"
    }
    if (activeTheme === "sunset") return "bg-gradient-to-br from-rose-50 via-orange-50 to-amber-100"
    if (activeTheme === "ocean") return "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100"
    return "bg-gradient-to-br from-indigo-50 via-slate-50 to-emerald-50"
  }, [activeTheme, effectivePreviewDark])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-ink/10 bg-paper/80 p-6 text-sm text-ink/70">
          {error}
        </div>
      </div>
    )
  }

  const resolvedProfile = data?.profile ?? mockProfile
  const resolvedBadges = data?.badges ?? mockBadges
  const resolvedRepos = data?.repos ?? mockRepos
  const socialLinks = (data?.settings?.social_links || {}) as Record<string, unknown>
  const contact = {
    email: typeof socialLinks.email === "string" ? socialLinks.email : undefined,
    phone: typeof socialLinks.phone === "string" ? socialLinks.phone : undefined,
    linkedin: typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : undefined,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-6 rounded-3xl border border-ink/10 bg-gradient-to-br from-[#eff7ff] via-[#f4fff8] to-[#fff8ec] p-5 shadow-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Reviewer Access</p>
        <h2 className="text-3xl font-semibold text-ink">Portfolio Review</h2>
        <p className="mt-2 text-sm text-ink/70">
          This read-only view is optimized for quick evaluation of profile quality, project depth, and skill signals.
        </p>
      </div>
      <div
        className={`rounded-3xl border border-ink/10 p-5 shadow-soft ${themedClass} ${
          effectivePreviewDark ? "dark preview-dark" : "preview-light"
        }`}
      >
        <PortfolioPreview
          profile={resolvedProfile}
          badges={resolvedBadges}
          repos={resolvedRepos}
          techStack={[]}
          aboutMe={resolvedProfile.bio}
          practiceDimensions={data?.practice_dimensions || []}
          educationHistory={[]}
          jobExperience={[]}
          enableRepoLinks
          contact={contact}
          showBadgeStatus={false}
        />
      </div>
    </div>
  )
}

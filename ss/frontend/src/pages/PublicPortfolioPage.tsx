import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import PortfolioPreview from "../components/PortfolioPreview"
import { fetchOwnerPortfolio, fetchPortfolio, getStoredAuth, updateSettings } from "../lib/api"
import type { Badge, PortfolioResponse, RepoSummary } from "../types"

type PublicPortfolioPageProps = {
  mode?: "public" | "owner"
}

type EducationItem = { year?: string; title: string }
type JobItem = {
  year?: string
  title: string
  company?: string
  location?: string
  start?: string
  end?: string
  description?: string
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || "").trim()).filter(Boolean)
}

function toEducationArray(value: unknown): EducationItem[] {
  if (!Array.isArray(value)) return []
  const rows: EducationItem[] = []
  value.forEach((item) => {
    const row = item as Record<string, unknown>
    const title = String(row?.title || "").trim()
    const year = String(row?.year || "").trim()
    if (!title) return
    rows.push({ title, year: year || undefined })
  })
  return rows
}

function toJobArray(value: unknown): JobItem[] {
  if (!Array.isArray(value)) return []
  const rows: JobItem[] = []
  value.forEach((item) => {
    const row = item as Record<string, unknown>
    const title = String(row?.title || "").trim()
    const year = String(row?.year || "").trim()
    const company = String(row?.company || "").trim()
    const location = String(row?.location || "").trim()
    const start = String(row?.start || "").trim()
    const end = String(row?.end || "").trim()
    const description = String(row?.description || "").trim()
    if (!title) return
    rows.push({
      title,
      year: year || undefined,
      company: company || undefined,
      location: location || undefined,
      start: start || undefined,
      end: end || undefined,
      description: description || undefined,
    })
  })
  return rows
}

function parseCsv(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function togglePick<T extends string>(list: T[], value: T) {
  if (list.includes(value)) return list.filter((item) => item !== value)
  return [...list, value]
}

function buildTechStackFromRepos(repos: RepoSummary[]) {
  const map = new Map<string, string>()
  repos.forEach((repo) => {
    if (repo.language && repo.language.toLowerCase() !== "unknown") map.set(repo.language.toLowerCase(), repo.language)
    ;(repo.languages || []).forEach((lang) => {
      const value = String(lang || "").trim()
      if (value) map.set(value.toLowerCase(), value)
    })
  })
  return Array.from(map.values()).slice(0, 16)
}

function generateAboutMe(data: PortfolioResponse | null) {
  if (!data) return ""
  const tech = buildTechStackFromRepos(data.repos).slice(0, 8)
  const topTech = [...tech].sort(() => Math.random() - 0.5).slice(0, Math.min(4, tech.length))
  const name = data.profile.displayName || data.profile.username
  const program = data.profile.program || "Computer Studies"
  const yearLevel = data.profile.yearLevel || "Student"
  const xp = data.profile.xp || 0
  const repoCount = data.repos.length

  const focusOptions =
    topTech.length > 0
      ? [
          `building practical projects using ${topTech.join(", ")}`,
          `creating portfolio-ready solutions with ${topTech.join(", ")}`,
          `improving full-cycle development skills through ${topTech.join(", ")}`,
        ]
      : [
          "building practical and portfolio-ready software projects",
          "improving implementation and delivery through hands-on development",
          "growing technical depth through consistent project execution",
        ]

  const openingOptions = [
    `${name} is a ${yearLevel} ${program} learner`,
    `${name} is currently focused on career-ready software development`,
    `${name} is an aspiring developer with a strong project-based mindset`,
  ]

  const strengthOptions = [
    `with ${repoCount} repositories and ${xp} XP showing consistent progress`,
    `combining structured learning with active coding practice`,
    `who values clean architecture, maintainable code, and clear documentation`,
  ]

  const closingOptions = [
    "Driven to turn ideas into reliable end-to-end solutions.",
    "Focused on delivering production-ready outputs and continuous improvement.",
    "Committed to building systems that are useful, scalable, and user-centered.",
  ]

  const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)]
  return `${pick(openingOptions)}, ${pick(focusOptions)}, ${pick(strengthOptions)}. ${pick(closingOptions)}`
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

export default function PublicPortfolioPage({ mode = "public" }: PublicPortfolioPageProps) {
  const { username } = useParams()
  const location = useLocation()
  const auth = getStoredAuth()
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [reviewerCopied, setReviewerCopied] = useState(false)
  const [generatedTechPreview, setGeneratedTechPreview] = useState("")
  const [generatedAboutPreview, setGeneratedAboutPreview] = useState("")

  const [darkPreview, setDarkPreview] = useState(false)
  const [themeLight, setThemeLight] = useState("aurora")
  const [themeDark, setThemeDark] = useState("aurora")
  const [showBadges, setShowBadges] = useState(true)
  const [showFeaturedRepos, setShowFeaturedRepos] = useState(true)
  const [techStackText, setTechStackText] = useState("")
  const [aboutMeText, setAboutMeText] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([])
  const [jobExperience, setJobExperience] = useState<JobItem[]>([])
  const [studentIdValue, setStudentIdValue] = useState("")
  const [programValue, setProgramValue] = useState("")
  const [yearLevelValue, setYearLevelValue] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactLinkedin, setContactLinkedin] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [featuredRepos, setFeaturedRepos] = useState<string[]>([])
  const [featuredBadges, setFeaturedBadges] = useState<string[]>([])
  const [fileBusy, setFileBusy] = useState(false)
  const socialLinksRef = useRef<Record<string, unknown>>({})

  const resolvedUsername = mode === "owner" ? auth.username || username : username
  const canEdit = mode === "owner" && Boolean(auth.token && auth.username)

  useEffect(() => {
    if (!resolvedUsername) {
      setData(null)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const payload =
          mode === "owner" && auth.token ? await fetchOwnerPortfolio(auth.token) : await fetchPortfolio(resolvedUsername)
        if (cancelled) return
        setData(payload)
      } catch {
        if (cancelled) return
        setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mode, resolvedUsername, auth.token])

  useEffect(() => {
    if (!data) return
    const socialLinks = (data.settings?.social_links || {}) as Record<string, unknown>
    socialLinksRef.current = socialLinks
    const sectionSettings = data.settings?.show_sections || {}

    setDarkPreview(Boolean(sectionSettings.preview_dark))
    setThemeLight(data.settings?.theme_light || data.settings?.theme || "aurora")
    setThemeDark(data.settings?.theme_dark || data.settings?.theme || "aurora")
    setShowBadges(sectionSettings.badges !== false)
    setShowFeaturedRepos(sectionSettings.repos !== false)
    setTechStackText(toStringArray(socialLinks.tech_stack).join(", "))
    setAboutMeText(data.settings?.bio || data.profile.bio || "")
    setProfileImage(typeof socialLinks.profile_image === "string" ? socialLinks.profile_image : "")
    setEducationHistory(toEducationArray(socialLinks.education_history))
    setJobExperience(toJobArray(socialLinks.job_experience))
    setStudentIdValue(typeof socialLinks.student_id === "string" ? socialLinks.student_id : data.profile.studentId || "")
    setProgramValue(typeof socialLinks.program === "string" ? socialLinks.program : data.profile.program || "")
    setYearLevelValue(typeof socialLinks.year_level === "string" ? socialLinks.year_level : data.profile.yearLevel || "")
    setContactEmail(typeof socialLinks.email === "string" ? socialLinks.email : "")
    setContactLinkedin(typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : "")
    setContactPhone(typeof socialLinks.phone === "string" ? socialLinks.phone : "")
    setFeaturedRepos(toStringArray(data.settings?.featured_repos))
    setFeaturedBadges(toStringArray(data.settings?.featured_badges))
  }, [data])

  useEffect(() => {
    if (!shareCopied) return
    const timer = window.setTimeout(() => setShareCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [shareCopied])

  useEffect(() => {
    if (!reviewerCopied) return
    const timer = window.setTimeout(() => setReviewerCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [reviewerCopied])

  const techStack = parseCsv(techStackText)
  const visibleRepos = useMemo(() => {
    if (!data) return []
    if (featuredRepos.length === 0) return data.repos
    return data.repos.filter((repo) => featuredRepos.includes(repo.name))
  }, [data, featuredRepos])
  const achievedBadges = (data?.badges || []).filter((badge) => badge.achieved)
  const visibleBadges: Badge[] = useMemo(() => {
    if (!data) return []
    if (featuredBadges.length === 0) return data.badges
    return data.badges.filter((badge) => featuredBadges.includes(badge.label))
  }, [data, featuredBadges])

  const previewBackground = useMemo(() => {
    const active = darkPreview ? themeDark : themeLight
    if (darkPreview) {
      if (active === "sunset") return "bg-gradient-to-br from-[#4a3b34] via-[#5f4a3d] to-[#6e5a45]"
      if (active === "ocean") return "bg-gradient-to-br from-[#25374d] via-[#2b4562] to-[#345877]"
      return "bg-gradient-to-br from-[#3b4458] via-[#465066] to-[#52607b]"
    }
    if (active === "sunset") return "bg-gradient-to-br from-[#f4e7d5] via-[#f0dfc7] to-[#ebd8b8]"
    if (active === "ocean") return "bg-gradient-to-br from-[#e2ebf4] via-[#dce8f3] to-[#d3e2ee]"
    return "bg-gradient-to-br from-[#e8ecf3] via-[#e4e9f2] to-[#dae2ee]"
  }, [darkPreview, themeDark, themeLight])

  if (!resolvedUsername) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Portfolio username not found.
        </div>
      </div>
    )
  }

  if (!data && !loading) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Unable to load portfolio.
        </div>
      </div>
    )
  }

  const shareUrl = `${window.location.origin}/p/${resolvedUsername}`
  const reviewerUrl = auth.token ? `${window.location.origin}/review/${auth.token}` : shareUrl
  const isFromAdmin = location.pathname.startsWith("/admin")

  const saveChanges = async () => {
    if (!auth.token || !canEdit) return
    setSaving(true)
    try {
      const updated = await updateSettings(auth.token, {
        theme_light: themeLight,
        theme_dark: themeDark,
        theme: themeLight,
        bio: aboutMeText.trim(),
        show_sections: {
          badges: showBadges,
          repos: showFeaturedRepos,
          preview_dark: darkPreview,
        },
        featured_repos: featuredRepos,
        featured_badges: featuredBadges,
        social_links: {
          ...socialLinksRef.current,
          tech_stack: techStack,
          profile_image: profileImage || undefined,
          education_history: educationHistory,
          job_experience: jobExperience,
          student_id: studentIdValue || undefined,
          program: programValue || undefined,
          year_level: yearLevelValue || undefined,
          email: contactEmail || undefined,
          linkedin: contactLinkedin || undefined,
          phone: contactPhone || undefined,
        },
      })
      setData(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={mode === "owner" ? "min-h-screen bg-gradient-to-b from-[#444d61] via-[#3f495f] to-[#394258]" : "min-h-screen"}
      style={{ fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {mode === "owner" ? (
          <section className="mb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#b8c2d8]">Public Portfolio</p>
                <h1 className="text-[48px] leading-none text-[#edf2fc]">Customize your live profile</h1>
                {isFromAdmin ? (
                  <a href="/admin" className="mt-1 inline-block text-[14px] text-[#d4dced] hover:underline">
                    Back to Admin
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full bg-[#cfb06c] px-5 py-2 text-[15px] font-semibold text-[#fff8e7] shadow-[0_0_40px_rgba(207,176,108,0.52)]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                      setShareCopied(true)
                    } catch {}
                  }}
                >
                  {shareCopied ? "Copied!" : "Share portfolio URL"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[#59647d] bg-[#404b62] px-5 py-2 text-[15px] font-semibold text-[#dfe5f3]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(reviewerUrl)
                      setReviewerCopied(true)
                    } catch {}
                  }}
                >
                  {reviewerCopied ? "Reviewer link copied" : "Generate reviewer link"}
                </button>
                <button
                  type="button"
                  disabled={saving || !canEdit}
                  className="rounded-full border border-[#59647d] bg-[#404b62] px-5 py-2 text-[15px] font-semibold text-[#dfe5f3] disabled:opacity-60"
                  onClick={saveChanges}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className={mode === "owner" ? "grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]" : ""}>
          {mode === "owner" ? (
            <aside className="rounded-[24px] border border-[#273249] bg-[#172035] p-6 text-[#d6deef]">
              <h2 className="text-[42px] leading-none text-white">Customization</h2>
              <div className="mt-4 max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1">
                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Theme</p>
                  <label className="mt-2 flex items-center gap-2 text-[20px] text-[#d8dfef]">
                    <input type="checkbox" checked={darkPreview} onChange={(event) => setDarkPreview(event.target.checked)} />
                    Dark
                  </label>
                  <div className="mt-2 flex gap-2">
                    {[
                      { value: "aurora", label: "Aurora" },
                      { value: "sunset", label: "Sunset" },
                      { value: "ocean", label: "Ocean" },
                    ].map((item) => (
                      <button
                        key={`theme-${item.value}`}
                        type="button"
                        className={`rounded-full px-4 py-1 text-[18px] font-semibold ${
                          themeLight === item.value ? "bg-[#cfb06c] text-[#fff8e7]" : "bg-transparent text-[#d2daec]"
                        }`}
                        onClick={() => setThemeLight(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </article>

                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Sections</p>
                  <label className="mt-2 flex items-center gap-2 text-[20px] text-[#d8dfef]">
                    <input type="checkbox" checked={showBadges} onChange={(event) => setShowBadges(event.target.checked)} />
                    Show badges
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-[20px] text-[#d8dfef]">
                    <input type="checkbox" checked={showFeaturedRepos} onChange={(event) => setShowFeaturedRepos(event.target.checked)} />
                    Show featured repos
                  </label>
                </article>

                <article>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[24px] font-semibold text-[#e5ebf8]">Tech stack</p>
                    <button
                      type="button"
                      className="text-[16px] font-semibold text-[#c6d0e5]"
                      onClick={() => {
                        const generated = buildTechStackFromRepos(data?.repos || []).join(", ")
                        setGeneratedTechPreview(generated)
                        setTechStackText(generated)
                      }}
                    >
                      AI generate
                    </button>
                  </div>
                  <div className="mt-2 rounded-[14px] bg-[#0d1527] p-3">
                    <p className="text-[15px] text-[#a2aec5]">Generated</p>
                    <p className="mt-1 text-[18px] text-[#ebeff8]">
                      {generatedTechPreview || techStackText || "No generated tech stack yet."}
                    </p>
                  </div>
                  <input
                    value={techStackText}
                    onChange={(event) => setTechStackText(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Manual add: React, FastAPI, PostgreSQL"
                  />
                </article>

                <article>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[24px] font-semibold text-[#e5ebf8]">About me</p>
                    <button
                      type="button"
                      className="text-[16px] font-semibold text-[#c6d0e5]"
                      onClick={() => {
                        const generated = generateAboutMe(data)
                        setGeneratedAboutPreview(generated)
                        setAboutMeText(generated)
                      }}
                    >
                      AI generate
                    </button>
                  </div>
                  <div className="mt-2 rounded-[14px] bg-[#0d1527] p-3">
                    <p className="text-[15px] text-[#a2aec5]">Generated</p>
                    <p className="mt-1 text-[18px] text-[#ebeff8]">
                      {generatedAboutPreview || aboutMeText || "No generated about me yet."}
                    </p>
                  </div>
                  <textarea
                    value={aboutMeText}
                    onChange={(event) => setAboutMeText(event.target.value)}
                    className="mt-2 h-24 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Manual add your about me..."
                  />
                </article>

                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Profile picture (1:1)</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] p-2 text-[16px] text-[#dee6f5]"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      setFileBusy(true)
                      try {
                        const asDataUrl = await fileToDataUrl(file)
                        setProfileImage(asDataUrl)
                      } finally {
                        setFileBusy(false)
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={fileBusy}
                    className="mt-2 rounded-[12px] border border-[#2d3953] bg-[#101b2e] px-3 py-1.5 text-[16px] text-[#d7deef] disabled:opacity-60"
                    onClick={() => setProfileImage("")}
                  >
                    Remove uploaded image
                  </button>
                </article>

                <article>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[24px] font-semibold text-[#e5ebf8]">Education history</p>
                    <button
                      type="button"
                      className="text-[16px] text-[#c6d0e5]"
                      onClick={() => setEducationHistory((prev) => [...prev, { title: "", year: "" }])}
                    >
                      Add education
                    </button>
                  </div>
                </article>

                <article>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[24px] font-semibold text-[#e5ebf8]">Job experience</p>
                    <button
                      type="button"
                      className="text-[16px] text-[#c6d0e5]"
                      onClick={() =>
                        setJobExperience((prev) => [
                          ...prev,
                          { title: "", company: "", location: "", start: "", end: "", description: "" },
                        ])
                      }
                    >
                      Add job
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {jobExperience.map((item, index) => (
                      <div key={`job-${index}`} className="rounded-[12px] border border-[#24304a] bg-[#10192d] p-2">
                        <input
                          value={item.title}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, title: event.target.value } : row))
                            )
                          }
                          className="w-full rounded-[10px] border border-[#2a3653] bg-[#0b1327] px-2 py-1.5 text-[15px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                          placeholder="Job Title (e.g. Frontend Developer Intern)"
                        />
                        <input
                          value={item.company || ""}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, company: event.target.value } : row))
                            )
                          }
                          className="mt-2 w-full rounded-[10px] border border-[#2a3653] bg-[#0b1327] px-2 py-1.5 text-[15px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                          placeholder="Company / Organization"
                        />
                        <input
                          value={item.location || ""}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, location: event.target.value } : row))
                            )
                          }
                          className="mt-2 w-full rounded-[10px] border border-[#2a3653] bg-[#0b1327] px-2 py-1.5 text-[15px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                          placeholder="Location (e.g. Manila, PH or Remote)"
                        />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            value={item.start || ""}
                            onChange={(event) =>
                              setJobExperience((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, start: event.target.value } : row))
                              )
                            }
                            className="w-full rounded-[10px] border border-[#2a3653] bg-[#0b1327] px-2 py-1.5 text-[15px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                            placeholder="Start (e.g. Jan 2025)"
                          />
                          <input
                            value={item.end || ""}
                            onChange={(event) =>
                              setJobExperience((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, end: event.target.value } : row))
                              )
                            }
                            className="w-full rounded-[10px] border border-[#2a3653] bg-[#0b1327] px-2 py-1.5 text-[15px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                            placeholder="End (e.g. Present)"
                          />
                        </div>
                        <textarea
                          value={item.description || ""}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, description: event.target.value } : row))
                            )
                          }
                          className="mt-2 h-16 w-full rounded-[10px] border border-[#2a3653] bg-[#0b1327] px-2 py-1.5 text-[15px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                          placeholder="Resume bullet highlights (achievements, tech used, impact)"
                        />
                        <button
                          type="button"
                          onClick={() => setJobExperience((prev) => prev.filter((_, i) => i !== index))}
                          className="mt-2 rounded-[10px] border border-[#3a4561] bg-[#15203a] px-3 py-1 text-[13px] text-[#d9e1f3]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </article>

                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Student information</p>
                  <input
                    value={studentIdValue}
                    onChange={(event) => setStudentIdValue(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Student ID"
                  />
                  <input
                    value={programValue}
                    onChange={(event) => setProgramValue(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Program (e.g. BSIT)"
                  />
                  <input
                    value={yearLevelValue}
                    onChange={(event) => setYearLevelValue(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Year Level (e.g. 3rd Year)"
                  />
                </article>

                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Contact</p>
                  <input
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Email"
                  />
                  <input
                    value={contactLinkedin}
                    onChange={(event) => setContactLinkedin(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="LinkedIn URL"
                  />
                  <input
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    className="mt-2 w-full rounded-[14px] border border-[#24304a] bg-[#0a1325] px-3 py-2 text-[18px] text-[#dee6f5] outline-none placeholder:text-[#8b97b1]"
                    placeholder="Contact number"
                  />
                </article>

                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Featured repos to display</p>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-[12px] border border-[#24304a] bg-[#10192d] p-2">
                    {(data?.repos || []).map((repo) => (
                      <label key={`repo-pick-${repo.name}`} className="mb-1 flex items-center gap-2 text-[18px] text-[#d5ddef]">
                        <input
                          type="checkbox"
                          checked={featuredRepos.includes(repo.name)}
                          onChange={() => setFeaturedRepos((prev) => togglePick(prev, repo.name))}
                        />
                        {repo.name}
                      </label>
                    ))}
                  </div>
                </article>

                <article>
                  <p className="text-[24px] font-semibold text-[#e5ebf8]">Badges to display</p>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-[12px] border border-[#24304a] bg-[#10192d] p-2">
                    {achievedBadges.map((badge) => (
                      <label key={`badge-pick-${badge.label}`} className="mb-1 flex items-center gap-2 text-[18px] text-[#d5ddef]">
                        <input
                          type="checkbox"
                          checked={featuredBadges.includes(badge.label)}
                          onChange={() => setFeaturedBadges((prev) => togglePick(prev, badge.label))}
                        />
                        {badge.label}
                      </label>
                    ))}
                  </div>
                </article>
              </div>
            </aside>
          ) : null}

          <div className={`${previewBackground} rounded-[24px] p-3`}>
            {loading || !data ? (
              <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">Loading...</div>
            ) : (
              <PortfolioPreview
                profile={data.profile}
                badges={visibleBadges}
                repos={visibleRepos}
                techStack={techStack}
                aboutMe={aboutMeText}
                practiceDimensions={data.practice_dimensions}
                educationHistory={educationHistory}
                jobExperience={jobExperience}
                contact={{
                  email: contactEmail || undefined,
                  linkedin: contactLinkedin || undefined,
                  phone: contactPhone || undefined,
                }}
                academic={{
                  studentId: studentIdValue || undefined,
                  program: programValue || undefined,
                  yearLevel: yearLevelValue || undefined,
                }}
                profileImage={profileImage || undefined}
                enableRepoLinks
                showBadgeStatus={mode !== "public"}
                showBadges={showBadges}
                showFeaturedRepos={showFeaturedRepos}
                canGenerateAbout={mode === "owner"}
                onGenerateAbout={() => {
                  const generated = generateAboutMe(data)
                  setGeneratedAboutPreview(generated)
                  setAboutMeText(generated)
                }}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

import type { Badge, PracticeDimension, RepoSummary, UserProfile } from "../types"

type JobExperienceItem = {
  year?: string
  title: string
  company?: string
  location?: string
  start?: string
  end?: string
  description?: string
}

type EducationHistoryItem = {
  year?: string
  title: string
}

type ContactInfo = {
  email?: string
  linkedin?: string
  phone?: string
}

type AcademicInfo = {
  studentId?: string
  program?: string
  yearLevel?: string
}

type PortfolioPreviewProps = {
  profile: UserProfile
  badges: Badge[]
  repos: RepoSummary[]
  techStack: string[]
  aboutMe: string
  practiceDimensions?: PracticeDimension[]
  educationHistory?: EducationHistoryItem[]
  jobExperience?: JobExperienceItem[]
  contact: ContactInfo
  academic?: AcademicInfo
  profileImage?: string
  enableRepoLinks?: boolean
  showBadgeStatus?: boolean
  showBadges?: boolean
  showFeaturedRepos?: boolean
  canGenerateAbout?: boolean
  onGenerateAbout?: () => void
}

function normalizeUrl(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  return `https://${value}`
}

function formatRepoDate(value?: string | null) {
  if (!value) return "recently"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed)
}

export default function PortfolioPreview({
  profile,
  badges,
  repos,
  techStack,
  aboutMe,
  practiceDimensions = [],
  educationHistory = [],
  jobExperience = [],
  contact,
  academic,
  profileImage,
  enableRepoLinks = false,
  showBadgeStatus = true,
  showBadges = true,
  showFeaturedRepos = true,
  canGenerateAbout = false,
  onGenerateAbout,
}: PortfolioPreviewProps) {
  const visibleBadges = badges.filter((badge) => badge.achieved || badge.claimed)
  const resolvedProfileImage = profileImage?.trim() ? profileImage.trim() : profile.avatarUrl
  const sortedDimensions = [...practiceDimensions].sort((a, b) => b.confidence - a.confidence)
  const strengths = sortedDimensions.slice(0, 3)

  return (
    <div className="rounded-[18px] border border-[#d9dce6] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6e8ef] pb-5">
        <div className="flex min-w-[260px] items-center gap-3">
          <img
            src={resolvedProfileImage}
            alt={profile.displayName}
            className="h-16 w-16 rounded-full border border-[#d3d8e7] object-cover"
          />
          <div>
            <h2 className="text-[30px] leading-none text-[#131722]">{profile.displayName}</h2>
            <p className="mt-1 text-[13px] text-[#5a6276]">@{profile.username}</p>
          </div>
        </div>
        <div className="text-[12px] text-[#5a6276]">
          <p>Level {profile.level}</p>
          <p>{profile.xp} XP</p>
          <p>{profile.streakDays} day streak</p>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-[12px] border border-[#e3e6f1] bg-[#fafbff] p-3">
            <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Student Information</h3>
            <div className="mt-2 space-y-1 text-[13px] text-[#2d3447]">
              <p>Student ID: {academic?.studentId || "Not set"}</p>
              <p>Program: {academic?.program || "Not set"}</p>
              <p>Year Level: {academic?.yearLevel || "Not set"}</p>
            </div>
          </section>

          <section className="rounded-[12px] border border-[#e3e6f1] bg-[#fafbff] p-3">
            <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Contact</h3>
            <div className="mt-2 space-y-1 text-[13px] text-[#2d3447]">
              {contact.email ? <p>{contact.email}</p> : null}
              {contact.phone ? <p>{contact.phone}</p> : null}
              {contact.linkedin ? (
                <a href={normalizeUrl(contact.linkedin)} target="_blank" rel="noreferrer" className="text-[#2f4bb8] hover:underline">
                  LinkedIn Profile
                </a>
              ) : null}
              {!contact.email && !contact.phone && !contact.linkedin ? <p className="text-[#6b7390]">No contact details yet.</p> : null}
            </div>
          </section>

          <section className="rounded-[12px] border border-[#e3e6f1] bg-[#fafbff] p-3">
            <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Core Skills</h3>
            {techStack.length === 0 ? (
              <p className="mt-2 text-[13px] text-[#6b7390]">No tech stack selected yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {techStack.map((item, index) => (
                  <span key={`${item}-${index}`} className="rounded-full border border-[#d4d9ea] bg-white px-2 py-0.5 text-[11px] text-[#34405a]">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>

          {strengths.length > 0 ? (
            <section className="rounded-[12px] border border-[#e3e6f1] bg-[#fafbff] p-3">
              <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Top Strengths</h3>
              <div className="mt-2 space-y-1.5">
                {strengths.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[12px] text-[#2f374a]">
                    <span>{item.label}</span>
                    <span className="font-semibold">{item.confidence}%</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {showBadges ? (
            <section className="rounded-[12px] border border-[#e3e6f1] bg-[#fafbff] p-3">
              <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Awards & Badges</h3>
              {visibleBadges.length === 0 ? (
                <p className="mt-2 text-[13px] text-[#6b7390]">No badges yet.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {visibleBadges.slice(0, 8).map((badge) => (
                    <div key={badge.label} className="rounded-[9px] border border-[#dbe0ef] bg-white px-2 py-1.5">
                      <p className="text-[12px] font-semibold text-[#232b3d]">{badge.label}</p>
                      {showBadgeStatus ? (
                        <p className="text-[10px] text-[#69728a]">{badge.claimed ? "Claimed" : badge.achieved ? "Achieved" : "Locked"}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </aside>

        <main className="space-y-4">
          <section className="rounded-[12px] border border-[#e3e6f1] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Professional Summary</h3>
              {canGenerateAbout ? (
                <button
                  type="button"
                  onClick={onGenerateAbout}
                  className="rounded-full border border-[#d4d9ea] bg-white px-3 py-1 text-[11px] font-semibold text-[#334164]"
                >
                  Generate
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#2d3447]">{aboutMe || "No profile summary yet."}</p>
          </section>

          {jobExperience.length > 0 ? (
            <section className="rounded-[12px] border border-[#e3e6f1] p-4">
              <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Experience</h3>
              <div className="mt-2 space-y-2.5">
                {jobExperience.map((item) => (
                  <div key={`${item.title}-${item.year || ""}`} className="rounded-[10px] border border-[#eef0f7] bg-[#fbfcff] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold text-[#1f2637]">
                        {item.title}
                        {item.company ? ` - ${item.company}` : ""}
                      </p>
                      <span className="text-[11px] text-[#69728a]">
                        {[item.start, item.end].filter(Boolean).join(" - ") || item.year || ""}
                      </span>
                    </div>
                    {item.location ? <p className="mt-1 text-[12px] text-[#69728a]">{item.location}</p> : null}
                    {item.description ? <p className="mt-1 text-[13px] text-[#39445f]">{item.description}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {educationHistory.length > 0 ? (
            <section className="rounded-[12px] border border-[#e3e6f1] p-4">
              <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Education</h3>
              <div className="mt-2 space-y-2">
                {educationHistory.map((item) => (
                  <div key={`${item.title}-${item.year || ""}`} className="rounded-[10px] border border-[#eef0f7] bg-[#fbfcff] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-[#1f2637]">{item.title}</p>
                      {item.year ? <span className="text-[11px] text-[#69728a]">{item.year}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {showFeaturedRepos ? (
            <section className="rounded-[12px] border border-[#e3e6f1] p-4">
              <h3 className="text-[12px] uppercase tracking-[0.16em] text-[#6b7390]">Featured Projects</h3>
              <div className="mt-2 space-y-2.5">
                {repos.map((repo) => {
                  const card = (
                    <div className="rounded-[10px] border border-[#eef0f7] bg-[#fbfcff] p-3 transition hover:border-[#cdd3e5]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[15px] font-semibold text-[#1f2637]">{repo.name}</p>
                        <span className="text-[11px] text-[#69728a]">{repo.language || "Unknown"}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-[#3b4660]">{repo.description || "No description provided."}</p>
                      <p className="mt-1 text-[11px] text-[#69728a]">Updated {formatRepoDate(repo.lastUpdated || repo.last_push)}</p>
                    </div>
                  )
                  if (!enableRepoLinks) return <div key={repo.name}>{card}</div>
                  const repoUrl = repo.htmlUrl || `https://github.com/${profile.username}/${repo.name}`
                  return (
                    <a key={repo.name} href={repoUrl} target="_blank" rel="noreferrer" className="block">
                      {card}
                    </a>
                  )
                })}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}

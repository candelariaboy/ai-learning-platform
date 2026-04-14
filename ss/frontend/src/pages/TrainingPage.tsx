import { useEffect, useMemo, useState } from "react"
import {
  autoSyncCertificates,
  claimWeeklyChallenge,
  fetchMyCareerConfidenceSurveys,
  fetchLearningAccounts,
  fetchMyCertificates,
  fetchWeeklyChallenges,
  fetchOwnerPortfolio,
  getStoredAuth,
  submitCareerConfidenceSurvey,
  submitCertificate,
  updateLearningAccounts,
} from "../lib/api"
import type { CareerConfidenceSurvey, CertificateRecord, LearningAccounts, WeeklyChallengePayload } from "../types"

function badgeClass(status: string) {
  const value = (status || "").toLowerCase()
  if (value === "verified" || value === "claimed") return "bg-[#E8F4F0] text-[#0F6E56]"
  if (value === "rejected") return "bg-[#FDECEC] text-[#A32D2D]"
  return "bg-[#FFF4E8] text-[#BA7517]"
}

const FCC_CERT_SLUGS: Record<string, string> = {
  "responsive web design": "responsive-web-design",
  "javascript algorithms and data structures": "javascript-algorithms-and-data-structures-v8",
  "front end development libraries": "front-end-development-libraries",
  "data visualization": "data-visualization",
  "relational database": "relational-database-v8",
  "back end development and apis": "back-end-development-and-apis",
  "quality assurance": "quality-assurance-v7",
  "scientific computing with python": "scientific-computing-with-python-v7",
  "data analysis with python": "data-analysis-with-python-v7",
  "machine learning with python": "machine-learning-with-python-v7",
}

// Friendly titles for display (preserve JavaScript casing)
const FCC_PRETTY_TITLES: Record<string, string> = {
  "responsive web design": "Responsive Web Design",
  "javascript algorithms and data structures": "JavaScript Algorithms and Data Structures",
  "front end development libraries": "Front End Development Libraries",
  "data visualization": "Data Visualization",
  "relational database": "Relational Database",
  "back end development and apis": "Back End Development and APIs",
  "quality assurance": "Quality Assurance",
  "scientific computing with python": "Scientific Computing with Python",
  "data analysis with python": "Data Analysis with Python",
  "machine learning with python": "Machine Learning with Python",
}

// Prefer linking to the learning path when recommending; fallback to certification URL when needed.
const FCC_LEARN_PATHS: Record<string, string> = {
  "responsive web design": "responsive-web-design-v9/",
  "javascript algorithms and data structures": "javascript-algorithms-and-data-structures/",
  "front end development libraries": "front-end-development-libraries/",
  "data visualization": "data-visualization/",
  "relational database": "relational-database-v8/",
  "back end development and apis": "back-end-development-and-apis/",
  "quality assurance": "quality-assurance-v7/",
  "scientific computing with python": "scientific-computing-with-python-v7/",
  "data analysis with python": "data-analysis-with-python-v7/",
  "machine learning with python": "machine-learning-with-python-v7/",
}

function resolveCertificateLink(cert: CertificateRecord, freecodecampUsername: string): string {
  const direct = String(cert?.certificate_url || "").trim()
  if (direct) return direct

  const isFcc = String(cert?.provider || "").toLowerCase().includes("freecodecamp")
  const username = String(freecodecampUsername || "").trim()
  if (!isFcc || !username) return ""

  const rawTitle = String(cert?.title || "")
    .replace(/^freecodecamp:\s*/i, "")
    .trim()
    .toLowerCase()
  const slug = FCC_CERT_SLUGS[rawTitle]
  if (!slug) return ""
  return `https://www.freecodecamp.org/certification/${username}/${slug}`
}

export default function TrainingPage() {
  const auth = getStoredAuth()
  const [accounts, setAccounts] = useState<LearningAccounts | null>(null)
  const [certificates, setCertificates] = useState<CertificateRecord[]>([])
  const [recommendedCerts, setRecommendedCerts] = useState<Array<{ title: string; slug?: string; link?: string }>>([])
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallengePayload | null>(null)
  const [fccUsername, setFccUsername] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [claimingKey, setClaimingKey] = useState("")
  const [toast, setToast] = useState("")
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [certTitle, setCertTitle] = useState("")
  const [certProvider, setCertProvider] = useState("")
  const [certUrl, setCertUrl] = useState("")
  const [submittingCert, setSubmittingCert] = useState(false)
  const [careerConfidenceRows, setCareerConfidenceRows] = useState<CareerConfidenceSurvey[]>([])
  const [confidencePhase, setConfidencePhase] = useState<"pre" | "post">("pre")
  const [confidenceScore, setConfidenceScore] = useState("70")
  const [confidenceClarity, setConfidenceClarity] = useState("70")
  const [confidenceFeedback, setConfidenceFeedback] = useState("")
  const [submittingConfidence, setSubmittingConfidence] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!auth.token) {
      setAccounts(null)
      setCertificates([])
      setWeeklyChallenges(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [acc, certs, challenges, confidence, ownerPortfolio] = await Promise.all([
          fetchLearningAccounts(auth.token),
          fetchMyCertificates(auth.token),
          fetchWeeklyChallenges(auth.token),
          fetchMyCareerConfidenceSurveys(auth.token),
          fetchOwnerPortfolio(auth.token),
        ])
        if (cancelled) return
        setAccounts(acc)
        setFccUsername(acc?.freecodecamp_username || "")
        setCertificates(Array.isArray(certs) ? certs : [])
        setWeeklyChallenges(challenges)
        setCareerConfidenceRows(Array.isArray(confidence) ? confidence : [])

        // Build recommended freeCodeCamp certificates based on practice_dimensions
        const practice = (ownerPortfolio?.practice_dimensions || []) as Array<{ label: string; confidence: number }>
        const recommendations: string[] = []
        const FCC_BY_GROUP: Record<string, string[]> = {
          frontend: ["responsive web design", "front end development libraries", "javascript algorithms and data structures"],
          backend: ["back end development and apis", "relational database"],
          data: ["data visualization", "data analysis with python", "machine learning with python"],
          systems: ["quality assurance", "scientific computing with python"],
        }

        const groupForLabel = (label = "") => {
          const s = String(label).toLowerCase()
          if (s.includes("frontend") || s.includes("web") || s.includes("ui")) return "frontend"
          if (s.includes("backend") || s.includes("software") || s.includes("api")) return "backend"
          if (s.includes("data") || s.includes("ml") || s.includes("ai")) return "data"
          if (s.includes("systems") || s.includes("devops") || s.includes("network")) return "systems"
          return null
        }

        const chosen = new Set<string>()
        const ordered = (practice || []).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        for (const item of ordered) {
          const group = groupForLabel(item.label)
          if (!group) continue
          const candidates = FCC_BY_GROUP[group] || []
          for (const cand of candidates) {
            if (!chosen.has(cand)) {
              chosen.add(cand)
              recommendations.push(cand)
            }
            if (recommendations.length >= 6) break
          }
          if (recommendations.length >= 6) break
        }

        const usernameForLinks = acc?.freecodecamp_username || ""
        const recs = recommendations.map((raw) => {
          const slug = FCC_CERT_SLUGS[raw]
          const pretty = FCC_PRETTY_TITLES[raw] ||
            raw
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")

          // Only link when we have an explicit learning path mapping or
          // when we can build a certification URL (username + slug).
          // Avoid deriving paths or falling back to the generic /learn homepage
          // to prevent opening potentially non-existent pages on freeCodeCamp.
          const mappedLearnPath = FCC_LEARN_PATHS[raw]
          let link: string | undefined = undefined
          if (mappedLearnPath) {
            link = `https://www.freecodecamp.org/learn/${mappedLearnPath}`
          } else if (usernameForLinks && slug) {
            link = `https://www.freecodecamp.org/certification/${usernameForLinks}/${slug}`
          }

          return { title: pretty, slug, link }
        })
        setRecommendedCerts(recs)
      } catch {
        if (cancelled) return
        setAccounts(null)
        setCertificates([])
        setWeeklyChallenges(null)
        setCareerConfidenceRows([])
        setRecommendedCerts([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [auth.token])

  const primaryChallenge = useMemo(
    () => (weeklyChallenges?.challenges || [])[0] || null,
    [weeklyChallenges?.challenges]
  )

  if (!auth.token) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to open training.
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
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Training</p>
          <h1 className="text-[24px] font-medium text-[#1E2538]">Learning and Certificates</h1>
        </div>
        <button
          type="button"
          disabled={syncing}
          className="rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
          onClick={async () => {
            if (!auth.token) return
            setSyncing(true)
            try {
              await autoSyncCertificates(auth.token)
              const [acc, certs] = await Promise.all([
                fetchLearningAccounts(auth.token),
                fetchMyCertificates(auth.token),
              ])
              setAccounts(acc)
              setCertificates(Array.isArray(certs) ? certs : [])
              setToast("Auto-sync completed.")
            } catch {
              setToast("Auto-sync failed.")
            } finally {
              setSyncing(false)
            }
          }}
        >
          {syncing ? "Syncing..." : "Auto-sync"}
        </button>
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[12px] border border-[#DDE1EB] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-medium text-[#1E2538]">FreeCodeCamp Certificates</h3>
            <button
              type="button"
              className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550]"
              onClick={() => setShowSubmitForm((prev) => !prev)}
            >
              Submit
            </button>
          </div>

          {showSubmitForm ? (
            <div className="mt-3 rounded-[10px] border border-[#E4E8F2] p-3">
              <div className="grid gap-2">
                <input
                  value={certTitle}
                  onChange={(event) => setCertTitle(event.target.value)}
                  className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
                  placeholder="Certificate title"
                />
                <input
                  value={certProvider}
                  onChange={(event) => setCertProvider(event.target.value)}
                  className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
                  placeholder="Provider (e.g. freeCodeCamp)"
                />
                <input
                  value={certUrl}
                  onChange={(event) => setCertUrl(event.target.value)}
                  className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
                  placeholder="Certificate URL"
                />
              </div>
              <button
                type="button"
                disabled={submittingCert}
                onClick={async () => {
                  if (!auth.token) return
                  if (!certTitle.trim() || !certProvider.trim() || !certUrl.trim()) {
                    setToast("All certificate fields are required.")
                    return
                  }
                  setSubmittingCert(true)
                  try {
                    await submitCertificate(auth.token, {
                      title: certTitle.trim(),
                      provider: certProvider.trim(),
                      certificate_url: certUrl.trim(),
                    })
                    const certs = await fetchMyCertificates(auth.token)
                    setCertificates(Array.isArray(certs) ? certs : [])
                    setCertTitle("")
                    setCertProvider("")
                    setCertUrl("")
                    setShowSubmitForm(false)
                    setToast("Certificate submitted.")
                  } catch {
                    setToast("Failed to submit certificate.")
                  } finally {
                    setSubmittingCert(false)
                  }
                }}
                className="mt-3 rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
              >
                {submittingCert ? "Submitting..." : "Submit certificate"}
              </button>
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {recommendedCerts.length > 0 ? (
              recommendedCerts.map((rec, idx) => (
                <div key={`${rec.title}-${idx}`} className="rounded-[10px] border border-[#E4E8F2] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-[#2A3145]">{rec.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] bg-[#FFF4E8] text-[#BA7517]`}>
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#6A7288]">Recommended based on your strengths</p>
                  {rec.link ? (
                    <a
                      href={rec.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-[8px] border border-[#D1D6E3] px-2.5 py-1 text-[11px] text-[#2E3550] hover:bg-[#F5F7FF]"
                    >
                      Open in freeCodeCamp
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[#6A7288]">No recommended certificates yet. Connect freeCodeCamp or add relevant project signals to get suggestions.</p>
            )}
          </div>

          <div className="mt-4 border-t border-[#E4E8F2] pt-3">
            <p className="text-[12px] font-medium text-[#2A3145]">Submitted Certificates</p>
            {certificates.length > 0 ? (
              <div className="mt-2 space-y-2">
                {certificates.slice(0, 8).map((cert, idx) => {
                  const certLink = resolveCertificateLink(cert, fccUsername)
                  return (
                    <div key={`${cert.id || cert.title || "cert"}-${idx}`} className="rounded-[10px] border border-[#E4E8F2] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-[#2A3145]">{cert.title || "Untitled certificate"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${badgeClass(cert.status || "pending")}`}>
                          {cert.status || "pending"}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#6A7288]">{cert.provider || "Unknown provider"}</p>
                      {certLink ? (
                        <a
                          href={certLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-[8px] border border-[#D1D6E3] px-2.5 py-1 text-[11px] text-[#2E3550] hover:bg-[#F5F7FF]"
                        >
                          Open certificate
                        </a>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-[#6A7288]">No submitted certificates yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-[12px] border border-[#DDE1EB] bg-white p-4">
          <h3 className="text-[15px] font-medium text-[#1E2538]">Learning Accounts</h3>
          <p className="mt-1 text-[12px] text-[#6A7288]">Connect platforms used for training sync.</p>

          <div className="mt-3 rounded-[10px] border border-[#E4E8F2] p-3">
            <p className="text-[12px] font-medium text-[#2A3145]">freeCodeCamp</p>
            <input
              value={fccUsername}
              onChange={(event) => setFccUsername(event.target.value)}
              className="mt-2 w-full rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
              placeholder="freecodecamp username"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[#6A7288]">
                Last sync: {accounts?.last_cert_sync_at ? new Date(accounts.last_cert_sync_at).toLocaleString() : "Never"}
              </p>
              <button
                type="button"
                disabled={savingAccount}
                onClick={async () => {
                  if (!auth.token) return
                  setSavingAccount(true)
                  try {
                    const updated = await updateLearningAccounts(auth.token, {
                      freecodecamp_username: fccUsername.trim(),
                    })
                    setAccounts(updated)
                    setToast("Learning account updated.")
                  } catch {
                    setToast("Failed to update learning account.")
                  } finally {
                    setSavingAccount(false)
                  }
                }}
                className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550] disabled:opacity-60"
              >
                {savingAccount ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Career Confidence Survey (Pre/Post)</h3>
        <p className="mt-1 text-[12px] text-[#6A7288]">
          Submit baseline (`pre`) and endline (`post`) confidence to track before/after change.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            value={confidencePhase}
            onChange={(event) => setConfidencePhase((event.target.value as "pre" | "post") || "pre")}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
          >
            <option value="pre">Pre (baseline)</option>
            <option value="post">Post (endline)</option>
          </select>
          <input
            value={confidenceScore}
            onChange={(event) => setConfidenceScore(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
            placeholder="Confidence score (0-100)"
          />
          <input
            value={confidenceClarity}
            onChange={(event) => setConfidenceClarity(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
            placeholder="Career clarity score (0-100)"
          />
          <input
            value={confidenceFeedback}
            onChange={(event) => setConfidenceFeedback(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
            placeholder="Optional feedback"
          />
        </div>
        <button
          type="button"
          disabled={submittingConfidence}
          className="mt-3 rounded-[8px] bg-[#0f766e] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
          onClick={async () => {
            if (!auth.token) return
            const score = Number(confidenceScore)
            const clarity = Number(confidenceClarity)
            if (!Number.isFinite(score) || score < 0 || score > 100) {
              setToast("Confidence score must be 0-100.")
              return
            }
            if (!Number.isFinite(clarity) || clarity < 0 || clarity > 100) {
              setToast("Clarity score must be 0-100.")
              return
            }
            setSubmittingConfidence(true)
            try {
              await submitCareerConfidenceSurvey(auth.token, {
                phase: confidencePhase,
                score,
                clarity_score: clarity,
                feedback: confidenceFeedback.trim() || undefined,
              })
              const confidence = await fetchMyCareerConfidenceSurveys(auth.token)
              setCareerConfidenceRows(Array.isArray(confidence) ? confidence : [])
              setToast("Career confidence survey submitted.")
            } catch {
              setToast("Failed to submit career confidence survey.")
            } finally {
              setSubmittingConfidence(false)
            }
          }}
        >
          {submittingConfidence ? "Submitting..." : "Submit confidence survey"}
        </button>
        <div className="mt-3 space-y-2">
          {careerConfidenceRows.slice(0, 4).map((row, index) => (
            <div key={`${row.phase}-${row.created_at}-${index}`} className="rounded-[10px] border border-[#E4E8F2] p-3">
              <p className="text-[12px] font-medium text-[#2A3145]">
                {row.phase.toUpperCase()} - Score {row.score} / Clarity {row.clarity_score ?? "-"}
              </p>
              <p className="mt-1 text-[11px] text-[#6A7288]">{String(row.created_at || "").slice(0, 10)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Weekly Challenge</h3>
        {primaryChallenge ? (
          <div className="mt-3 rounded-[10px] border border-[#E4E8F2] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-[#2A3145]">{primaryChallenge.title}</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">{primaryChallenge.description}</p>
              </div>
              <span className="rounded-full bg-[#EEEDFE] px-2 py-0.5 text-[10px] text-[#3C3489]">
                +{primaryChallenge.reward_xp} XP
              </span>
            </div>
            <div className="mt-3 h-[4px] rounded-full bg-[#D8DDEB]">
              <div
                className="h-[4px] rounded-full bg-[#534AB7]"
                style={{ width: `${primaryChallenge.claimed ? 100 : primaryChallenge.completed ? 80 : 20}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[#6A7288]">
                {primaryChallenge.claimed
                  ? "Reward claimed"
                  : primaryChallenge.completed
                    ? "Ready to claim"
                    : "In progress"}
              </p>
              <button
                type="button"
                disabled={
                  claimingKey === primaryChallenge.key || !primaryChallenge.completed || primaryChallenge.claimed
                }
                onClick={async () => {
                  if (!auth.token) return
                  setClaimingKey(primaryChallenge.key)
                  try {
                    await claimWeeklyChallenge(auth.token, primaryChallenge.key)
                    const challenges = await fetchWeeklyChallenges(auth.token)
                    setWeeklyChallenges(challenges)
                    setToast("Weekly challenge reward claimed.")
                  } catch {
                    setToast("Failed to claim challenge.")
                  } finally {
                    setClaimingKey("")
                  }
                }}
                className="rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
              >
                {primaryChallenge.claimed
                  ? "Claimed"
                  : claimingKey === primaryChallenge.key
                    ? "Claiming..."
                    : "Claim"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-[#6A7288]">No weekly challenge data available.</p>
        )}
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { registerUser, setStoredAuth } from "../lib/api"

export default function RegisterPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token") || ""
  const username = params.get("username") || ""
  const avatar = params.get("avatar") || ""
  const defaultName = params.get("display_name") || ""
  const defaultBio = params.get("bio") || ""

  const [displayName, setDisplayName] = useState(defaultName)
  const [bio, setBio] = useState(defaultBio)
  const [studentId, setStudentId] = useState("")
  const [program, setProgram] = useState("")
  const [yearLevel, setYearLevel] = useState("")
  const [careerInterest, setCareerInterest] = useState("")
  const [preferredLearningStyle, setPreferredLearningStyle] = useState("")
  const [targetRole, setTargetRole] = useState("")
  const [targetCertificationsInput, setTargetCertificationsInput] = useState("")
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => Boolean(token), [token])

  useEffect(() => {
    if (token && username) {
      setStoredAuth(token, username)
    }
  }, [token, username])

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-ink/10 bg-white/70 p-8 shadow-soft backdrop-blur">
        <div className="flex items-center gap-4">
          {avatar ? <img src={avatar} alt={username} className="h-16 w-16 rounded-2xl" /> : null}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Registration</p>
            <h2 className="text-2xl font-semibold">Welcome, @{username}</h2>
            <p className="text-sm text-ink/60">Complete your profile to finish setup.</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              placeholder="Your name"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="min-h-[120px] rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              placeholder="Tell the community what you are building"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Student ID
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                placeholder="e.g. 2024-00123"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Program
              <select
                value={program}
                onChange={(event) => setProgram(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              >
                <option value="">Select program</option>
                <option value="BSCS">BSCS</option>
                <option value="BSIT">BSIT</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Year Level
              <select
                value={yearLevel}
                onChange={(event) => setYearLevel(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              >
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Career Interest
              <input
                value={careerInterest}
                onChange={(event) => setCareerInterest(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                placeholder="e.g. Web Development, Data Science"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Preferred Learning Style
              <select
                value={preferredLearningStyle}
                onChange={(event) => setPreferredLearningStyle(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              >
                <option value="">Select style</option>
                <option value="Project-based">Project-based</option>
                <option value="Video-first">Video-first</option>
                <option value="Reading & Docs">Reading & Docs</option>
                <option value="Guided Labs">Guided Labs</option>
                <option value="Mixed">Mixed</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Target Role
              <input
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                placeholder="e.g. Frontend Developer"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Target Certifications
              <input
                value={targetCertificationsInput}
                onChange={(event) => setTargetCertificationsInput(event.target.value)}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                placeholder="Comma-separated (e.g. AWS CCP, Google Data Analytics)"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled={!canSubmit || loading}
            onClick={async () => {
              setLoading(true)
              const targetCertifications = targetCertificationsInput
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
              await registerUser(token, {
                display_name: displayName,
                bio,
                student_id: studentId,
                program,
                year_level: yearLevel,
                career_interest: careerInterest,
                preferred_learning_style: preferredLearningStyle,
                target_role: targetRole,
                target_certifications: targetCertifications,
              })
              navigate(`/dashboard?token=${token}`)
            }}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Finish setup
          </button>
          <button
            onClick={() => navigate(`/dashboard?token=${token}`)}
            className="rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold text-ink/70"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

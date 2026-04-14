const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000"

const TOKEN_KEY = "devpath_token"
const USERNAME_KEY = "devpath_username"
const ADMIN_TOKEN_KEY = "devpath_admin_token"
const ADMIN_USERNAME_KEY = "devpath_admin_username"
const ADMIN_ROLE_KEY = "devpath_admin_role"
const FEATURE_FLAGS_KEY = "devpath_feature_flags"
const FIRST_SEEN_PREFIX = "devpath_first_seen_at:"

const ACADEMIC_TRACK_TITLE_MAP: Record<string, string> = {
  "Frontend Engineer": "Frontend Engineer",
  "Backend Engineer": "Backend Engineer",
  "Full-Stack Engineer": "Full-Stack Engineer",
  "Data Analyst": "Data Analyst",
  "Machine Learning Engineer": "Machine Learning Engineer",
  "DevOps Engineer": "DevOps Engineer",
  "Mobile Developer": "Mobile Developer",
  "Security Engineer": "Security Engineer",
  "QA Engineer": "QA Engineer",
}

function normalizeCareerSuggestions(
  items: Array<{ title: string; confidence: number; reasoning: string }> | undefined
) {
  return (items || []).map((item) => {
    const rawTitle = String(item?.title || "").trim()
    const title = ACADEMIC_TRACK_TITLE_MAP[rawTitle] || rawTitle || "Career Recommendation"

    const rawReasoning = String(item?.reasoning || "").trim()
    const hasAcademicNote = /BSCS\/BSIT curriculum outcomes/i.test(rawReasoning)
    const reasoning = rawReasoning
      ? hasAcademicNote
        ? rawReasoning
        : `${rawReasoning} Aligned to BSCS/BSIT curriculum outcomes.`
      : "Recommended from your repository signals and aligned to BSCS/BSIT curriculum outcomes."

    return {
      ...item,
      title,
      reasoning,
    }
  })
}

export type FeatureFlags = {
  sus_auto_prompt: boolean
  premium_portfolio_motion: boolean
  peer_recommendations: boolean
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  sus_auto_prompt: true,
  premium_portfolio_motion: false,
  peer_recommendations: false,
}

export function setStoredAuth(token: string, username: string) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  }
  if (username) {
    localStorage.setItem(USERNAME_KEY, username)
    markUserFirstSeen(username)
  }
}

export function getStoredAuth() {
  return {
    token: localStorage.getItem(TOKEN_KEY) || "",
    username: localStorage.getItem(USERNAME_KEY) || "",
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

export function markUserFirstSeen(username: string) {
  if (!username) return
  const key = `${FIRST_SEEN_PREFIX}${username.toLowerCase()}`
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, new Date().toISOString())
  }
}

export function getUserFirstSeen(username: string) {
  if (!username) return ""
  return localStorage.getItem(`${FIRST_SEEN_PREFIX}${username.toLowerCase()}`) || ""
}

export function getFeatureFlags(): FeatureFlags {
  const raw = localStorage.getItem(FEATURE_FLAGS_KEY)
  if (!raw) {
    return { ...DEFAULT_FEATURE_FLAGS }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>
    return {
      ...DEFAULT_FEATURE_FLAGS,
      ...parsed,
    }
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS }
  }
}

export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean) {
  const next = {
    ...getFeatureFlags(),
    [flag]: enabled,
  }
  localStorage.setItem(FEATURE_FLAGS_KEY, JSON.stringify(next))
  return next
}

export function setStoredAdminAuth(token: string, username: string, role: "admin" | "faculty" = "admin") {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
  }
  if (username) {
    localStorage.setItem(ADMIN_USERNAME_KEY, username)
  }
  localStorage.setItem(ADMIN_ROLE_KEY, role)
}

export function getStoredAdminAuth() {
  return {
    token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
    username: localStorage.getItem(ADMIN_USERNAME_KEY) || "",
    role: (localStorage.getItem(ADMIN_ROLE_KEY) as "admin" | "faculty" | null) || "admin",
  }
}

export function clearStoredAdminAuth() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(ADMIN_USERNAME_KEY)
  localStorage.removeItem(ADMIN_ROLE_KEY)
}

/** Clears admin credentials then hard-navigates (avoids a React frame still on `/admin/*` without a token → 404 / stuck UI). */
export function signOutAdmin(redirectPath: string = "/") {
  clearStoredAdminAuth()
  window.location.replace(redirectPath)
}

/**
 * Helper for admin-protected fetches. Attaches `Authorization` header when `token` is provided
 * and handles 401/403 by clearing admin auth and redirecting to `/admin-login`.
 */
async function adminFetch(path: string, token: string, options: RequestInit = {}) {
  const nextHeaders: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) || {} }
  if (token) nextHeaders.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: nextHeaders })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAdminAuth()
      // hard navigate to admin login to ensure UI reset
      window.location.replace("/admin-login")
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}
/**
 * Helper for user/student-protected fetches. Attaches `Authorization` header
 * when `token` is provided and handles 401/403 by clearing auth and
 * redirecting to the app root so the login flow can re-run.
 */
async function authFetch(path: string, token: string, options: RequestInit = {}) {
  const nextHeaders: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) || {} }
  if (token) nextHeaders.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: nextHeaders })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAuth()
      // Go back to root so the app can perform sign-in flow
      window.location.replace("/")
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}

function normalizeProfile(raw: {
  username: string
  display_name?: string | null
  bio?: string | null
  avatar_url: string
  level: number
  xp: number
  next_level_xp: number
  streak_days: number
  has_recommendation_action?: boolean | null
  student_id?: string | null
  program?: string | null
  year_level?: string | null
  career_interest?: string | null
  preferred_learning_style?: string | null
  target_role?: string | null
  target_certifications?: string[] | null
  portfolio_completeness?: number | null
  is_verified?: boolean | null
  verified_at?: string | null
}) {
  return {
    username: raw.username,
    displayName: raw.display_name || raw.username,
    bio: raw.bio || "",
    avatarUrl: raw.avatar_url,
    level: raw.level,
    xp: raw.xp,
    nextLevelXp: raw.next_level_xp,
    streakDays: raw.streak_days,
    hasRecommendationAction:
      typeof raw.has_recommendation_action === "boolean" ? raw.has_recommendation_action : undefined,
    studentId: raw.student_id || undefined,
    program: raw.program || undefined,
    yearLevel: raw.year_level || undefined,
    careerInterest: raw.career_interest || undefined,
    preferredLearningStyle: raw.preferred_learning_style || undefined,
    targetRole: raw.target_role || undefined,
    targetCertifications: raw.target_certifications || [],
    portfolioCompleteness:
      typeof raw.portfolio_completeness === "number" ? raw.portfolio_completeness : undefined,
    isVerified: typeof raw.is_verified === "boolean" ? raw.is_verified : undefined,
    verifiedAt: raw.verified_at || undefined,
  }
}

function normalizeResponse(data: {
  profile: {
    username: string
    display_name?: string | null
    bio?: string | null
    avatar_url: string
    level: number
    xp: number
    next_level_xp: number
    streak_days: number
    has_recommendation_action?: boolean | null
    student_id?: string | null
    program?: string | null
    year_level?: string | null
    career_interest?: string | null
    preferred_learning_style?: string | null
    target_role?: string | null
    target_certifications?: string[] | null
    portfolio_completeness?: number | null
    is_verified?: boolean | null
    verified_at?: string | null
  }
  practice_dimensions: Array<{
    label: string
    confidence: number
    evidence: string[]
  }>
  career_suggestions: Array<{
    title: string
    confidence: number
    reasoning: string
  }>
  skill_domains?: Array<{
    dimension_key: string
    domain: string
    description: string
    score_percent: number
    level: string
    evidence: string[]
  }> | null
  focus_domain?: {
    dimension_key: string
    domain: string
    description: string
    score_percent: number
    level: string
    evidence: string[]
  } | null
  frequency?: {
    total_commits: number
    repo_count: number
    active_repos_30d: number
    weekly_commits: Array<{ week_start: string; commit_count: number }>
    weekly_commit_average: number
    streak_days: number
  } | null
  badges: Array<{
    label: string
    description: string
    criteria: string
    rarity: "common" | "rare" | "epic"
    achieved?: boolean
    claimed?: boolean
    reward_xp?: number
    medal_tier?: string
    medal_icon?: string
    category?: string
    category_icon?: string
    icon?: string
    target?: number
  }>
  repos: Array<{
    name: string
    description?: string | null
    language?: string | null
    languages?: string[] | null
    language_bytes?: Record<string, number> | null
    html_url?: string | null
    stars: number
    last_push?: string | null
    commit_count?: number
  }>
}) {
  return {
    profile: normalizeProfile(data.profile),
    practice_dimensions: data.practice_dimensions,
    career_suggestions: normalizeCareerSuggestions(data.career_suggestions),
    skill_domains: data.skill_domains || [],
    focus_domain: data.focus_domain || null,
    frequency: data.frequency || null,
    badges: data.badges,
    repos: data.repos.map((repo) => ({
      name: repo.name,
      description: repo.description || "",
      language: repo.language || "Unknown",
      languages: repo.languages || [],
      languageBytes: repo.language_bytes || {},
      htmlUrl: repo.html_url || undefined,
      stars: repo.stars,
      last_push: repo.last_push || undefined,
      commitCount: repo.commit_count,
    })),
  }
}

export async function getGithubLoginUrl(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/github/login`)
  if (!response.ok) {
    throw new Error("Unable to start GitHub login")
  }
  const data = (await response.json()) as { url: string }
  return data.url
}

export async function fetchUser(username: string) {
  const response = await fetch(`${API_BASE}/api/user/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch user")
  }
  const data = await response.json()
  return normalizeResponse(data)
}

export async function fetchPortfolio(username: string) {
  const response = await fetch(`${API_BASE}/api/portfolio/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch portfolio")
  }
  const data = await response.json()
  return {
    ...normalizeResponse(data),
    settings: data.settings || {},
  }
}

export async function fetchOwnerPortfolio(token: string) {
  const data = await authFetch(`/api/user/me/portfolio`, token)
  return {
    ...normalizeResponse(data),
    settings: data.settings || {},
  }
}

export async function pingAuth(token: string) {
  return authFetch(`/api/ping`, token)
}

export async function logoutAuth(token: string) {
  return authFetch(`/api/logout`, token, { method: "POST" })
}

export async function registerUser(
  token: string,
  payload: {
    display_name?: string
    bio?: string
    student_id?: string
    program?: string
    year_level?: string
    career_interest?: string
    preferred_learning_style?: string
    target_role?: string
    target_certifications?: string[]
  }
) {
  return authFetch(`/api/register`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchLeaderboard() {
  const response = await fetch(`${API_BASE}/api/leaderboard`)
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard")
  }
  const data = (await response.json()) as Array<{
    id: number
    username: string
    avatar_url: string
    level: number
    xp: number
    delta: string
  }>
  return data.map((entry) => ({
    id: String(entry.id),
    username: entry.username,
    avatarUrl: entry.avatar_url,
    level: entry.level,
    xp: entry.xp,
    delta: entry.delta,
  }))
}

export async function fetchLearningPath(username: string) {
  const response = await fetch(`${API_BASE}/api/learning-path/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch learning path")
  }
  return response.json()
}

export async function fetchProjectLearningPaths(username: string) {
  const response = await fetch(`${API_BASE}/api/learning-path/projects/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch project learning paths")
  }
  return response.json()
}

export async function updateLearningStepStatus(
  token: string,
  payload: { learning_step: string; status: "todo" | "in_progress" | "done" }
) {
  return authFetch(`/api/learning-path/steps/status`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchCurriculumMap(username: string) {
  const response = await fetch(`${API_BASE}/api/curriculum-map/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch curriculum map")
  }
  return response.json()
}

export async function fetchRuleRecommendations(username: string) {
  const response = await fetch(`${API_BASE}/api/recommendations/v2/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch recommendations")
  }
  return response.json()
}

export async function fetchUserMeStatus(token: string) {
  return authFetch(`/api/ping`, token) as Promise<{ ok: boolean; has_recommendation_action?: boolean }>
}

export async function fetchWeeklyDigest(username: string) {
  const response = await fetch(`${API_BASE}/api/digest/weekly/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch weekly digest")
  }
  return response.json()
}

export async function fetchMyCertificates(token: string) {
  return authFetch(`/api/certificates/me`, token)
}

export async function submitCertificate(
  token: string,
  payload: { title: string; provider: string; certificate_url: string }
) {
  return authFetch(`/api/certificates/submit`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchLearningAccounts(token: string) {
  return authFetch(`/api/learning-accounts/me`, token)
}

export async function updateLearningAccounts(token: string, payload: { freecodecamp_username?: string }) {
  return authFetch(`/api/learning-accounts/me`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchLearningAccountStats(token: string, refresh = false) {
  return authFetch(`/api/learning-accounts/stats?refresh=${refresh ? "true" : "false"}`, token)
}

export async function autoSyncCertificates(token: string) {
  return authFetch(`/api/certificates/auto-sync`, token, { method: "POST" })
}

export async function fetchDailyQuests(token: string) {
  return authFetch(`/api/quests/daily`, token)
}

export async function claimDailyQuest(token: string, questKey: string) {
  return authFetch(`/api/quests/daily/claim`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quest_key: questKey }),
  })
}

export async function fetchWeeklyChallenges(token: string) {
  return authFetch(`/api/challenges/weekly`, token)
}

export async function claimWeeklyChallenge(token: string, challengeKey: string) {
  return authFetch(`/api/challenges/weekly/claim`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_key: challengeKey }),
  })
}

export async function trackRecommendationAction(
  token: string,
  payload: {
    dimension_key?: string
    module_title: string
    module_url: string
    action?: string
    action_type?: string
    rating?: number
    feedback?: string
  }
) {
  return authFetch(`/api/recommendations/action`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function submitSusSurvey(token: string, payload: { score: number; feedback?: string }) {
  return authFetch(`/api/surveys/sus`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchMySusSurveys(token: string) {
  return authFetch(`/api/surveys/sus/me`, token)
}

export async function submitCareerConfidenceSurvey(
  token: string,
  payload: { phase: "pre" | "post"; score: number; clarity_score?: number; feedback?: string }
) {
  return authFetch(`/api/surveys/career-confidence`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchMyCareerConfidenceSurveys(token: string) {
  return authFetch(`/api/surveys/career-confidence/me`, token)
}

export async function fetchMyPortfolioCompleteness(token: string) {
  return authFetch(`/api/portfolio-completeness/me`, token)
}

export async function adminLogin(payload: { username: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let detail = "Failed to login"
    try {
      const data = (await response.json()) as { detail?: string }
      if (typeof data.detail === "string" && data.detail.trim()) {
        detail = data.detail
      }
    } catch {
      // Keep fallback detail message when backend body is not JSON.
    }
    throw new Error(detail)
  }
  return response.json()
}

export async function facultyLogin(payload: { username: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/faculty/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let detail = "Failed to login"
    try {
      const data = (await response.json()) as { detail?: string }
      if (typeof data.detail === "string" && data.detail.trim()) {
        detail = data.detail
      }
    } catch {
      // no-op
    }
    throw new Error(detail)
  }
  return response.json()
}

export async function fetchAdminStudents(token: string) {
  return adminFetch(`/admin/students`, token)
}

export async function fetchAdminStudentDetails(token: string, studentId: number) {
  const response = await fetch(`${API_BASE}/admin/students/${studentId}/details`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (response.ok) {
    return response.json()
  }
  if (response.status === 401 || response.status === 403) {
    clearStoredAdminAuth()
    window.location.replace("/admin-login")
    throw new Error(`Request failed: ${response.status}`)
  }
  // Backward-compatible fallback for older backend versions where
  // `/admin/students/{id}/details` is not yet available.
  if (response.status === 404) {
    const students = (await fetchAdminStudents(token)) as Array<{
      id: number
      username: string
      display_name?: string | null
      avatar_url: string
      level: number
      xp: number
      repo_count: number
      badges_claimed: number
      online: boolean
      last_seen?: string | null
      program?: string | null
      year_level?: string | null
      is_verified?: boolean
      verified_at?: string | null
    }>
    const student = students.find((item) => Number(item.id) === Number(studentId))
    if (!student) {
      throw new Error("Request failed: 404")
    }

    const [notes, validations, interventions, reviews, userSummary] = await Promise.all([
      fetchAdminNotes(token, studentId).catch(() => []),
      fetchProjectValidations(token, studentId).catch(() => []),
      fetchInterventions(token, studentId).catch(() => []),
      fetchPortfolioReviews(token, studentId).catch(() => []),
      fetchUser(student.username).catch(() => null),
    ])

    const repos = Array.isArray(userSummary?.repos) ? userSummary.repos : []
    const practiceDimensions = Array.isArray(userSummary?.practice_dimensions)
      ? userSummary.practice_dimensions
      : []
    const careerSuggestions = Array.isArray(userSummary?.career_suggestions)
      ? userSummary.career_suggestions
      : []
    const totalCommits = repos.reduce((sum, repo) => sum + Number(repo.commitCount || 0), 0)
    const totalStars = repos.reduce((sum, repo) => sum + Number(repo.stars || 0), 0)
    const topRepos = [...repos]
      .sort((a, b) => Number(b.commitCount || 0) - Number(a.commitCount || 0))
      .slice(0, 6)
      .map((repo) => ({
        name: repo.name,
        description: repo.description || "",
        language: repo.language || "Unknown",
        stars: Number(repo.stars || 0),
        commit_count: Number(repo.commitCount || 0),
        last_push: repo.last_push || null,
      }))

    return {
      student,
      profile: {
        bio: userSummary?.profile?.bio || "",
        student_id: userSummary?.profile?.studentId || "",
        career_interest: userSummary?.profile?.careerInterest || "",
        preferred_learning_style: userSummary?.profile?.preferredLearningStyle || "",
        target_role: userSummary?.profile?.targetRole || "",
        target_certifications: userSummary?.profile?.targetCertifications || [],
        created_at: null,
      },
      overview: {
        total_commits: totalCommits,
        total_stars: totalStars,
        repo_count: Number(student.repo_count || 0),
        badges_claimed: Number(student.badges_claimed || 0),
        certificates_total: 0,
        certificates_verified: 0,
        recommendation_actions_total: 0,
        recommendation_acceptance_rate: 0,
        recommendation_relevance_rate: 0,
        portfolio_completeness: userSummary?.profile?.portfolioCompleteness || 0,
        sus_latest: null,
        sus_average: null,
        days_since_last_seen: null,
      },
      top_repos: topRepos,
      practice_dimensions: practiceDimensions,
      career_suggestions: careerSuggestions,
      recent_recommendations: [],
      recent_activity: [],
      certificates: [],
      validations: validations || [],
      interventions: interventions || [],
      notes: notes || [],
      reviews: reviews || [],
    }
  }
  throw new Error(`Request failed: ${response.status}`)
}

export async function verifyAdminStudent(
  token: string,
  payload: { student_id: number; is_verified: boolean }
) {
  return adminFetch(`/admin/students/verify`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as Promise<{ student_id: number; is_verified: boolean; verified_at?: string | null }>
}

export async function deleteAdminStudent(token: string, studentId: number) {
  return adminFetch(`/admin/students/${studentId}`, token, { method: "DELETE" }) as Promise<{ deleted: number }>
}

export async function deleteAllAdminStudents(token: string, confirm: string) {
  return adminFetch(`/admin/students`, token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  }) as Promise<{ deleted: number }>
}

export async function exportAdminStudentsCsv(token: string) {
  const response = await fetch(`${API_BASE}/admin/export/students.csv`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAdminAuth()
      window.location.replace("/admin-login")
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  const contentDisposition = response.headers.get("Content-Disposition") || ""
  const match = contentDisposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] || "students_report.csv"
  const blob = await response.blob()
  return { blob, filename }
}

export async function fetchAdminAnalytics(token: string) {
  return adminFetch(`/admin/analytics`, token)
}

export async function fetchAdminEvaluationMetrics(token: string) {
  return adminFetch(`/admin/evaluation/metrics`, token)
}

export async function fetchAdminDeepAnalytics(token: string, range: "1h" | "1d" | "7d" | "30d" = "7d") {
  return adminFetch(`/admin/analytics/deep?range=${range}`, token)
}

export async function resetAdminAnalytics(token: string) {
  return adminFetch(`/admin/analytics/reset`, token, { method: "POST" })
}

export async function fetchEngagementAnalytics(token: string) {
  return authFetch(`/analytics/engagement`, token)
}

export async function fetchActivityTimeline(token: string) {
  return authFetch(`/analytics/activity-timeline`, token)
}

export async function fetchLoginActivity(token: string) {
  return authFetch(`/analytics/login-activity`, token)
}

export async function fetchLoginTrends(token: string) {
  return authFetch(`/analytics/login-trends`, token)
}

export async function fetchLoginLive(token: string) {
  return authFetch(`/analytics/login-live`, token)
}

export async function fetchMyProjectValidations(token: string) {
  return authFetch(`/api/validations/me`, token)
}


export async function fetchAdminNotes(token: string, studentId: number) {
  return adminFetch(`/admin/notes/${studentId}`, token)
}

export async function createAdminNote(token: string, payload: { student_id: number; note: string }) {
  return adminFetch(`/admin/notes`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchProjectValidations(token: string, studentId: number) {
  return adminFetch(`/admin/validations/${studentId}`, token)
}

export async function fetchAllProjectValidations(token: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return adminFetch(`/admin/validations${query}`, token)
}

export async function fetchPendingCertificates(token: string) {
  return adminFetch(`/admin/certificates/pending`, token)
}

export async function reviewCertificate(
  token: string,
  payload: { certificate_id: number; status: string; reviewer_note?: string }
) {
  return adminFetch(`/admin/certificates/review`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchInterventions(token: string, studentId: number) {
  return adminFetch(`/admin/interventions/${studentId}`, token)
}

export async function fetchAllInterventions(token: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return adminFetch(`/admin/interventions${query}`, token)
}

export async function createIntervention(
  token: string,
  payload: {
    student_id: number
    title: string
    action_plan: string
    priority?: string
    target_date?: string
    status?: string
  }
) {
  return adminFetch(`/admin/interventions`, token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export async function createProjectValidation(
  token: string,
  payload: { student_id: number; repo_name: string; status: string; comment?: string }
) {
  return adminFetch(`/admin/validations`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function createBulkProjectValidations(
  token: string,
  payload: { student_id: number; items: Array<{ repo_name: string; status: string; comment?: string }> }
) {
  return adminFetch(`/admin/validations/bulk`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function reviewCertificatesBulk(
  token: string,
  payload: { items: Array<{ certificate_id: number; status: string; reviewer_note?: string }> }
) {
  return adminFetch(`/admin/certificates/review/bulk`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchInterventionAlerts(token: string) {
  return adminFetch(`/admin/intervention-alerts`, token)
}

export async function fetchCohortComparison(token: string) {
  return adminFetch(`/admin/cohort-comparison`, token)
}

export async function fetchResearchAnalytics(token: string) {
  return adminFetch(`/admin/research/analytics`, token)
}


export async function updateSettings(
  token: string,
  payload: {
    theme?: string
    theme_light?: string
    theme_dark?: string
    show_sections?: Record<string, boolean>
    featured_repos?: string[]
    featured_badges?: string[]
    social_links?: Record<string, unknown>
    bio?: string
    cover_image?: string
    is_public?: boolean
  }
) {
  const data = await authFetch(`/api/user/settings`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return {
    ...normalizeResponse(data),
    settings: data.settings || {},
  }
}

export async function recomputeInsights(token: string) {
  const data = await authFetch(`/api/user/recompute`, token, { method: "POST" })
  return normalizeResponse(data)
}

export async function claimBadges(token: string) {
  const data = await authFetch(`/api/user/claim-badges`, token, { method: "POST" })
  return normalizeResponse(data)
}

export async function fetchPortfolioReviews(token: string, studentId: number) {
  return adminFetch(`/admin/portfolio-reviews/${studentId}`, token)
}

export async function createPortfolioReview(
  token: string,
  payload: { student_id: number; status: string; summary: string }
) {
  return adminFetch(`/admin/portfolio-reviews`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchReviewPortfolio(token: string) {
  return authFetch(`/api/review/`, token)
}

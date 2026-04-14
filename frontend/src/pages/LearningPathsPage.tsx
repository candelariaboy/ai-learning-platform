import { useEffect, useMemo, useState } from "react"
import {
  fetchLearningPath,
  fetchOwnerPortfolio,
  getStoredAuth,
  recomputeInsights,
  trackRecommendationAction,
  updateLearningStepStatus,
} from "../lib/api"
import type { LearningPathResponse, PortfolioResponse } from "../types"

type StepFeedback = {
  decision?: "accepted" | "rejected"
  rating?: number
}

type StepResource = {
  id: string
  label: string
  url: string
  kind: "course" | "skill" | "certification"
  keywords: string[]
  dimensions?: string[]
  levels?: string[]
  note?: string
}

const STEP_RESOURCE_LIMITS = {
  certification: 4,
  course: 3,
  skill: 3,
} as const

const RESOURCE_LIBRARY: StepResource[] = [
  {
    id: "mdn",
    label: "MDN Web Docs",
    url: "https://developer.mozilla.org/en-US/docs/Learn",
    kind: "course",
    keywords: ["frontend", "web", "html", "css", "javascript", "typescript", "ui", "react", "vue", "angular"],
    dimensions: ["frontend_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "frontend-mentor",
    label: "Frontend Mentor Challenges",
    url: "https://www.frontendmentor.io/challenges",
    kind: "skill",
    keywords: ["frontend", "responsive", "components", "layout", "ui"],
    dimensions: ["frontend_engineering"],
    levels: ["beginner", "intermediate"],
    note: "Hands-on UI practice tasks.",
  },
  {
    id: "the-odin-project",
    label: "The Odin Project",
    url: "https://www.theodinproject.com/",
    kind: "course",
    keywords: ["frontend", "web", "html", "css", "javascript", "fullstack", "projects"],
    dimensions: ["frontend_engineering", "backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "javascript-info",
    label: "JavaScript.info",
    url: "https://javascript.info/",
    kind: "course",
    keywords: ["javascript", "frontend", "web", "fundamentals"],
    dimensions: ["frontend_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "react-docs",
    label: "React Docs",
    url: "https://react.dev/learn",
    kind: "course",
    keywords: ["react", "frontend", "components", "hooks", "routing", "state"],
    dimensions: ["frontend_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "tailwind-docs",
    label: "Tailwind CSS Docs",
    url: "https://tailwindcss.com/docs",
    kind: "skill",
    keywords: ["tailwind", "css", "frontend", "ui", "responsive"],
    dimensions: ["frontend_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "fastapi",
    label: "FastAPI Tutorial",
    url: "https://fastapi.tiangolo.com/tutorial/",
    kind: "course",
    keywords: ["backend", "api", "service", "python", "authentication", "authorization", "rest"],
    dimensions: ["backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "python-docs",
    label: "Python Official Tutorial",
    url: "https://docs.python.org/3/tutorial/",
    kind: "course",
    keywords: ["python", "backend", "foundation", "beginner"],
    dimensions: ["backend_systems_engineering", "data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "owasp-top10",
    label: "OWASP Top 10 (Web Security)",
    url: "https://owasp.org/www-project-top-ten/",
    kind: "skill",
    keywords: ["security", "auth", "oauth", "jwt", "backend", "web", "vulnerabilities"],
    dimensions: ["backend_systems_engineering", "systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "postman-learning",
    label: "Postman API Fundamentals",
    url: "https://learning.postman.com/",
    kind: "skill",
    keywords: ["api", "rest", "testing", "backend", "requests"],
    dimensions: ["backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "system-design-primer",
    label: "System Design Primer",
    url: "https://github.com/donnemartin/system-design-primer",
    kind: "course",
    keywords: ["architecture", "scalable", "system", "queue", "cache", "performance", "advanced"],
    dimensions: ["backend_systems_engineering"],
    levels: ["advanced"],
  },
  {
    id: "kaggle",
    label: "Kaggle Learn",
    url: "https://www.kaggle.com/learn",
    kind: "course",
    keywords: ["data", "analysis", "python", "notebook", "pandas", "numpy"],
    dimensions: ["data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "pandas-docs",
    label: "Pandas Getting Started",
    url: "https://pandas.pydata.org/docs/getting_started/index.html",
    kind: "skill",
    keywords: ["pandas", "data", "analysis", "python", "dataframe"],
    dimensions: ["data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "numpy-docs",
    label: "NumPy Quickstart",
    url: "https://numpy.org/doc/stable/user/quickstart.html",
    kind: "skill",
    keywords: ["numpy", "data", "analysis", "python", "arrays"],
    dimensions: ["data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "google-ml",
    label: "Google ML Crash Course",
    url: "https://developers.google.com/machine-learning/crash-course",
    kind: "course",
    keywords: ["ml", "ai", "model", "intelligence", "feature", "training"],
    dimensions: ["data_science_intelligence"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "sklearn",
    label: "scikit-learn Tutorials",
    url: "https://scikit-learn.org/stable/tutorial/index.html",
    kind: "course",
    keywords: ["ml", "machine learning", "model", "sklearn", "scikit", "python"],
    dimensions: ["data_science_intelligence"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "sqlbolt",
    label: "SQLBolt",
    url: "https://sqlbolt.com/",
    kind: "skill",
    keywords: ["sql", "database", "postgres", "mysql", "sqlite", "query"],
    dimensions: ["data_science_intelligence", "backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "mode-sql",
    label: "Mode SQL Tutorial",
    url: "https://mode.com/sql-tutorial/",
    kind: "course",
    keywords: ["sql", "database", "query", "joins", "analysis"],
    dimensions: ["data_science_intelligence", "backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "microsoft-devops",
    label: "Microsoft Learn DevOps",
    url: "https://learn.microsoft.com/en-us/training/career-paths/devops-engineer",
    kind: "course",
    keywords: ["devops", "ci", "cd", "deployment", "monitoring", "observability"],
    dimensions: ["systems_devops_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "docker",
    label: "Docker Get Started",
    url: "https://docs.docker.com/get-started/",
    kind: "skill",
    keywords: ["docker", "container", "compose", "image"],
    dimensions: ["systems_devops_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "github-actions",
    label: "GitHub Actions Docs",
    url: "https://docs.github.com/en/actions",
    kind: "skill",
    keywords: ["ci", "cd", "github actions", "pipeline", "automation", "devops"],
    dimensions: ["systems_devops_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "linux-journey",
    label: "Linux Journey",
    url: "https://linuxjourney.com/",
    kind: "course",
    keywords: ["linux", "shell", "systems", "devops", "terminal"],
    dimensions: ["systems_devops_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "kubernetes",
    label: "Kubernetes Basics",
    url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/",
    kind: "course",
    keywords: ["kubernetes", "cluster", "orchestration", "pods", "advanced"],
    dimensions: ["systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "testing-js",
    label: "Testing JavaScript",
    url: "https://testingjavascript.com/",
    kind: "course",
    keywords: ["testing", "test", "quality", "unit", "integration", "e2e"],
    dimensions: ["frontend_engineering", "backend_systems_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "pytest",
    label: "pytest Documentation",
    url: "https://docs.pytest.org/en/stable/",
    kind: "skill",
    keywords: ["pytest", "testing", "unit", "integration", "python", "backend"],
    dimensions: ["backend_systems_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "playwright",
    label: "Playwright Docs",
    url: "https://playwright.dev/docs/intro",
    kind: "skill",
    keywords: ["playwright", "e2e", "testing", "frontend", "automation"],
    dimensions: ["frontend_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "roadmap-sh",
    label: "roadmap.sh",
    url: "https://roadmap.sh/",
    kind: "skill",
    keywords: ["roadmap", "career", "learning path", "frontend", "backend", "devops"],
    dimensions: ["frontend_engineering", "backend_systems_engineering", "data_science_intelligence", "systems_devops_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "freecodecamp",
    label: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/",
    kind: "certification",
    keywords: ["foundation", "beginner", "practice", "project"],
    dimensions: ["frontend_engineering", "backend_systems_engineering", "data_science_intelligence", "systems_devops_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
    note: "Free certificates available on completion.",
  },
  {
    id: "microsoft-learn",
    label: "Microsoft Learn (Browse)",
    url: "https://learn.microsoft.com/en-us/training/browse/",
    kind: "certification",
    keywords: ["certification", "microsoft", "learn", "modules", "course"],
    dimensions: ["frontend_engineering", "backend_systems_engineering", "data_science_intelligence", "systems_devops_engineering"],
    levels: ["beginner", "intermediate", "advanced"],
    note: "Official training paths and certification prep.",
  },
  {
    id: "github-foundations",
    label: "GitHub Foundations (Certification)",
    url: "https://learn.microsoft.com/en-us/credentials/certifications/github-foundations/",
    kind: "certification",
    keywords: ["github", "git", "version control", "certification"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering", "frontend_engineering"],
    levels: ["beginner", "intermediate"],
    note: "Good baseline credential for Git/GitHub workflows.",
  },
  {
    id: "aws-cloud-practitioner",
    label: "AWS Certified Cloud Practitioner",
    url: "https://aws.amazon.com/certification/certified-cloud-practitioner/",
    kind: "certification",
    keywords: ["aws", "cloud", "certification", "exam", "foundation", "devops", "deployment"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
    note: "Entry-level AWS credential; broad cloud services overview.",
  },
  {
    id: "aws-developer-associate",
    label: "AWS Certified Developer – Associate",
    url: "https://aws.amazon.com/certification/certified-developer-associate/",
    kind: "certification",
    keywords: ["aws", "api", "serverless", "lambda", "backend", "certification", "exam"],
    dimensions: ["backend_systems_engineering", "systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "azure-fundamentals",
    label: "Microsoft Azure Fundamentals (AZ-900)",
    url: "https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/",
    kind: "certification",
    keywords: ["azure", "cloud", "microsoft", "certification", "exam", "foundation"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering", "data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "azure-developer",
    label: "Microsoft Azure Developer Associate (AZ-204)",
    url: "https://learn.microsoft.com/en-us/credentials/certifications/azure-developer/",
    kind: "certification",
    keywords: ["azure", "api", "backend", "certification", "microsoft", "exam"],
    dimensions: ["backend_systems_engineering", "systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "gcp-digital-leader",
    label: "Google Cloud Digital Leader",
    url: "https://cloud.google.com/learn/certification/cloud-digital-leader",
    kind: "certification",
    keywords: ["gcp", "google cloud", "cloud", "certification", "exam", "foundation"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering", "data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "gcp-associate-engineer",
    label: "Google Associate Cloud Engineer",
    url: "https://cloud.google.com/learn/certification/cloud-engineer",
    kind: "certification",
    keywords: ["gcp", "kubernetes", "cloud", "certification", "exam", "deployment"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "terraform-associate",
    label: "HashiCorp Terraform Associate",
    url: "https://developer.hashicorp.com/certifications/terraform-associate",
    kind: "certification",
    keywords: ["terraform", "iac", "devops", "infrastructure", "certification", "exam"],
    dimensions: ["systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "cka",
    label: "Certified Kubernetes Administrator (CKA)",
    url: "https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/",
    kind: "certification",
    keywords: ["kubernetes", "k8s", "cluster", "devops", "certification", "exam", "containers"],
    dimensions: ["systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "docker-cca",
    label: "Docker Certified Associate (DCA)",
    url: "https://success.docker.com/certifications",
    kind: "certification",
    keywords: ["docker", "container", "compose", "certification", "exam", "devops"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "meta-frontend-cert",
    label: "Meta Front-End Developer Certificate (Coursera)",
    url: "https://www.coursera.org/professional-certificates/meta-front-end-developer",
    kind: "certification",
    keywords: ["react", "frontend", "javascript", "html", "css", "certification", "career"],
    dimensions: ["frontend_engineering"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "mongodb-associate",
    label: "MongoDB Associate Developer Exam",
    url: "https://learn.mongodb.com/pages/mongodb-associate-developer-exam",
    kind: "certification",
    keywords: ["mongodb", "database", "nosql", "backend", "api", "certification", "exam"],
    dimensions: ["backend_systems_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "postgresql-associate",
    label: "EDB PostgreSQL Associate Certification",
    url: "https://www.enterprisedb.com/services-training/certification/postgresql-associate-certification",
    kind: "certification",
    keywords: ["postgres", "postgresql", "sql", "database", "backend", "certification", "exam"],
    dimensions: ["backend_systems_engineering", "data_science_intelligence"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "oracle-java-oca",
    label: "Oracle Java SE Certification (path)",
    url: "https://education.oracle.com/oracle-certification",
    kind: "certification",
    keywords: ["java", "backend", "spring", "certification", "oracle", "exam"],
    dimensions: ["backend_systems_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "comptia-security-plus",
    label: "CompTIA Security+",
    url: "https://www.comptia.org/certifications/security",
    kind: "certification",
    keywords: ["security", "auth", "compliance", "certification", "exam", "network"],
    dimensions: ["backend_systems_engineering", "systems_devops_engineering"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "cissp-overview",
    label: "ISC2 CISSP (cybersecurity leadership)",
    url: "https://www.isc2.org/Certifications/CISSP",
    kind: "certification",
    keywords: ["security", "risk", "governance", "certification", "exam", "advanced"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering"],
    levels: ["advanced"],
  },
  {
    id: "tensorflow-developer",
    label: "TensorFlow Developer Certificate",
    url: "https://www.tensorflow.org/certificate",
    kind: "certification",
    keywords: ["tensorflow", "ml", "deep learning", "python", "model", "certification", "exam"],
    dimensions: ["data_science_intelligence"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "deeplearning-ai",
    label: "DeepLearning.AI Professional Certificates",
    url: "https://www.deeplearning.ai/",
    kind: "certification",
    keywords: ["ml", "ai", "deep learning", "neural", "certification", "course"],
    dimensions: ["data_science_intelligence"],
    levels: ["intermediate", "advanced"],
    note: "Structured programs with credentials from partner platforms.",
  },
  {
    id: "tableau-desktop-specialist",
    label: "Tableau Desktop Specialist",
    url: "https://www.tableau.com/learn/certification/desktop-specialist",
    kind: "certification",
    keywords: ["tableau", "visualization", "bi", "data", "analysis", "certification", "exam"],
    dimensions: ["data_science_intelligence"],
    levels: ["beginner", "intermediate"],
  },
  {
    id: "power-bi-pl300",
    label: "Microsoft Power BI Data Analyst (PL-300)",
    url: "https://learn.microsoft.com/en-us/credentials/certifications/power-bi-data-analyst-associate/",
    kind: "certification",
    keywords: ["power bi", "bi", "dashboard", "sql", "data", "analysis", "certification", "microsoft"],
    dimensions: ["data_science_intelligence"],
    levels: ["intermediate", "advanced"],
  },
  {
    id: "microsoft-sc-900",
    label: "Microsoft Security, Compliance, and Identity (SC-900)",
    url: "https://learn.microsoft.com/en-us/credentials/certifications/security-compliance-and-identity-fundamentals/",
    kind: "certification",
    keywords: ["security", "identity", "compliance", "microsoft", "certification", "exam", "foundation"],
    dimensions: ["systems_devops_engineering", "backend_systems_engineering"],
    levels: ["beginner", "intermediate"],
  },
]

function kindLabel(kind: StepResource["kind"]) {
  if (kind === "course") return "Course"
  if (kind === "skill") return "Skill"
  return "Certification"
}

function groupByKind(resources: StepResource[]) {
  return {
    certifications: resources.filter((r) => r.kind === "certification"),
    courses: resources.filter((r) => r.kind === "course"),
    skills: resources.filter((r) => r.kind === "skill"),
  }
}

/** Text from the personalized learning-path step; used to scope skill links. */
type LearningPathStepForResources = {
  title?: string
  reason?: string
  tag?: string
  tags?: string[]
  dimension_key?: string
  evidence?: string[]
}

function learningPathSkillSearchQuery(step: LearningPathStepForResources): string {
  const parts: string[] = []
  if (step.title?.trim()) parts.push(step.title.trim())
  if (step.tags?.length) parts.push(...step.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6))
  if (step.tag?.trim()) parts.push(step.tag.trim())
  if (step.reason?.trim()) parts.push(step.reason.trim().slice(0, 140))
  if (step.evidence?.length) parts.push(...step.evidence.map((t) => String(t).trim()).filter(Boolean).slice(0, 3))
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 220)
}

/**
 * Skill chips open documentation/search that incorporates this step’s title, tags, and reason
 * (not only the generic catalog homepage).
 */
function learningPathSkillHref(step: LearningPathStepForResources, resource: StepResource): string {
  if (resource.kind !== "skill") return resource.url

  const q = learningPathSkillSearchQuery(step)
  if (!q) return resource.url

  const e = encodeURIComponent
  const id = resource.id

  const direct: Partial<Record<string, string>> = {
    mdn: `https://developer.mozilla.org/en-US/search?q=${e(q)}`,
    "react-docs": `https://developer.mozilla.org/en-US/search?q=${e(`${q} React`)}`,
    "javascript-info": `https://javascript.info/search/?query=${e(q)}`,
    "pandas-docs": `https://pandas.pydata.org/docs/search.html?q=${e(q)}`,
    "numpy-docs": `https://numpy.org/doc/stable/search.html?q=${e(q)}`,
    pytest: `https://docs.pytest.org/en/stable/search.html?q=${e(q)}`,
  }

  if (direct[id]) return direct[id] as string

  try {
    const host = new URL(resource.url).hostname.replace(/^www\./, "")
    if (!host) return resource.url
    return `https://duckduckgo.com/?q=${e(`${q} ${resource.label} site:${host}`)}`
  } catch {
    return resource.url
  }
}

type ResourceGuessStep = {
  title?: string
  reason?: string
  tag?: string
  tags?: string[]
  dimension_key?: string
  evidence?: string[]
  difficulty?: string
}

type ScoredResource = {
  resource: StepResource
  score: number
}

const RESOURCE_KINDS: StepResource["kind"][] = ["certification", "course", "skill"]

function normalizeStepDimension(step: ResourceGuessStep): string {
  return String(step.dimension_key || step.tag || "").toLowerCase().trim()
}

function scoreResourcesForStep(step: ResourceGuessStep): ScoredResource[] {
  const searchable = [
    step.title || "",
    step.reason || "",
    step.tag || "",
    step.dimension_key || "",
    step.difficulty || "",
    ...(step.tags || []),
    ...(step.evidence || []),
  ]
  const tokens = searchable.join(" ").toLowerCase()
  const normalizedLevel = String(step.difficulty || "").toLowerCase()
  const dimension = normalizeStepDimension(step)

  return RESOURCE_LIBRARY.map((resource) => {
    let score = 0
    if (resource.dimensions?.some((item) => item.toLowerCase() === dimension)) {
      score += 5
    }
    if (normalizedLevel && resource.levels?.includes(normalizedLevel)) {
      score += 2
    }
    resource.keywords.forEach((keyword) => {
      if (tokens.includes(keyword.toLowerCase())) {
        score += 1
      }
    })
    return { resource, score }
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
}

function fallbackResourceForKind(
  kind: StepResource["kind"],
  step: ResourceGuessStep,
  localPicked: Set<string>,
  usedAcrossSteps: Set<string>
): StepResource | null {
  const dimension = normalizeStepDimension(step)

  const domainUnused = RESOURCE_LIBRARY.find(
    (resource) =>
      resource.kind === kind &&
      !localPicked.has(resource.id) &&
      !usedAcrossSteps.has(resource.id) &&
      !!dimension &&
      !!resource.dimensions?.some((item) => item.toLowerCase() === dimension)
  )
  if (domainUnused) return domainUnused

  const anyUnused = RESOURCE_LIBRARY.find(
    (resource) => resource.kind === kind && !localPicked.has(resource.id) && !usedAcrossSteps.has(resource.id)
  )
  if (anyUnused) return anyUnused

  const reusableDomain = RESOURCE_LIBRARY.find(
    (resource) =>
      resource.kind === kind &&
      !localPicked.has(resource.id) &&
      !!dimension &&
      !!resource.dimensions?.some((item) => item.toLowerCase() === dimension)
  )
  if (reusableDomain) return reusableDomain

  return RESOURCE_LIBRARY.find((resource) => resource.kind === kind && !localPicked.has(resource.id)) || null
}

function pickStepResources(step: ResourceGuessStep, usedAcrossSteps: Set<string>): StepResource[] {
  const scored = scoreResourcesForStep(step)
  const picks: StepResource[] = []
  const localPicked = new Set<string>()

  for (const kind of RESOURCE_KINDS) {
    let taken = 0
    const target = STEP_RESOURCE_LIMITS[kind]
    const kindScored = scored.filter((entry) => entry.resource.kind === kind)
    for (const entry of kindScored) {
      if (taken >= target) break
      if (usedAcrossSteps.has(entry.resource.id) || localPicked.has(entry.resource.id)) continue
      picks.push(entry.resource)
      localPicked.add(entry.resource.id)
      taken += 1
    }
  }

  // Ensure every step gets at least one item for each category.
  for (const kind of RESOURCE_KINDS) {
    if (picks.some((resource) => resource.kind === kind)) continue
    const fallback = fallbackResourceForKind(kind, step, localPicked, usedAcrossSteps)
    if (!fallback) continue
    picks.push(fallback)
    localPicked.add(fallback.id)
  }

  for (const resource of picks) {
    usedAcrossSteps.add(resource.id)
  }

  return picks
}

function guessResourcesForSteps(steps: ResourceGuessStep[]): Record<string, StepResource[]> {
  const usedAcrossSteps = new Set<string>()
  const byStep: Record<string, StepResource[]> = {}
  steps.forEach((step, index) => {
    const feedbackKey = `${index}-${step.title}`
    byStep[feedbackKey] = pickStepResources(step, usedAcrossSteps)
  })
  return byStep
}

export default function LearningPathsPage() {
  const auth = getStoredAuth()
  const [learningPath, setLearningPath] = useState<LearningPathResponse | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [pathError, setPathError] = useState("")
  const [feedback, setFeedback] = useState<Record<string, StepFeedback>>({})
  const [stepSavingKey, setStepSavingKey] = useState("")

  useEffect(() => {
    if (!auth.username || !auth.token) {
      setLearningPath(null)
      setPortfolio(null)
      setPathError("")
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setPathError("")
      try {
        const [lp, me] = await Promise.all([fetchLearningPath(auth.username), fetchOwnerPortfolio(auth.token)])
        if (cancelled) return
        setLearningPath(lp)
        setPortfolio(me)
      } catch {
        if (cancelled) return
        setLearningPath(null)
        setPortfolio(null)
        setPathError("No personalized steps yet. Add more repos or refresh your insights.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [auth.username, auth.token])

  const hasRepoActivity = (portfolio?.repos || []).length > 0
  const practiceDimensions = portfolio?.practice_dimensions || []
  const steps = learningPath?.steps || []
  const overallProgress = Math.max(0, Math.min(100, Number(learningPath?.progress_percent || 0)))
  const stepResources = useMemo(() => guessResourcesForSteps(steps), [steps])

  const adoption = useMemo(() => {
    const values = Object.values(feedback)
    const accepted = values.filter((item) => item.decision === "accepted").length
    const rejected = values.filter((item) => item.decision === "rejected").length
    const total = accepted + rejected
    return {
      accepted,
      rejected,
      rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      hasAny: total > 0,
    }
  }, [feedback])

  const logStepAction = async (
    step: {
      title?: string
      tag?: string
      dimension_key?: string
    },
    action: "accepted" | "rejected" | "rated",
    rating?: number
  ) => {
    if (!auth.token) return
    const moduleTitle = (step.title || "Learning step").trim() || "Learning step"
    const moduleUrl = `app://learning-path/${encodeURIComponent(moduleTitle)}`
    await trackRecommendationAction(auth.token, {
      dimension_key: step.dimension_key || step.tag || undefined,
      module_title: moduleTitle,
      module_url: moduleUrl,
      action,
      rating,
    })
  }

  const refreshLearningPath = async () => {
    if (!auth.username || !auth.token) return
    const [lp, me] = await Promise.all([fetchLearningPath(auth.username), fetchOwnerPortfolio(auth.token)])
    setLearningPath(lp)
    setPortfolio(me)
    setPathError("")
  }

  if (!auth.username) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to view your learning path.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <section className="dp-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Training/Certification</p>
            <h1 className="text-[26px] font-semibold text-[#1E2538]">Practice dimensions</h1>
          </div>
          <button
            type="button"
            disabled={recomputing || !auth.token}
            className="rounded-[8px] border border-[#c7d2f1] bg-[#f8faff] px-3 py-1.5 text-[11px] font-medium text-[#2E3550] disabled:opacity-60"
            onClick={async () => {
              if (!auth.token) return
              setRecomputing(true)
              try {
                await recomputeInsights(auth.token)
                await refreshLearningPath()
              } catch {
                setPathError("No personalized steps yet. Add more repos or refresh your insights.")
              } finally {
                setRecomputing(false)
              }
            }}
          >
            {recomputing ? "Recomputing..." : "Recompute Insights"}
          </button>
        </div>
      </section>

      {!hasRepoActivity ? (
        <section className="dp-card p-4 text-[12px] text-[#6A7288]">
          No repo activity detected yet. Add commits or code to your GitHub projects, then click Recompute Insights.
        </section>
      ) : null}

      <section className="dp-card p-5">
        <h3 className="text-[18px] font-medium text-[#1E2538]">Practice Dimensions</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {practiceDimensions.map((item, index) => (
            <article key={`${item.label}-${index}`} className="rounded-[10px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
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
              </div>
            </article>
          ))}
          {practiceDimensions.length === 0 ? (
            <p className="text-[12px] text-[#6A7288]">
              No repo signals yet. Practice dimensions will appear once your GitHub has activity.
            </p>
          ) : null}
        </div>
      </section>

      <section className="dp-card p-5">
        <h3 className="text-[18px] font-medium text-[#1E2538]">Personalized Training Path</h3>
        <p className="mt-1 text-[12px] text-[#6A7288]">Progress {overallProgress}%</p>
        {loading ? <p className="mt-2 text-[12px] text-[#6A7288]">Loading...</p> : null}
        {adoption.hasAny ? (
          <p className="mt-1 text-[12px] text-[#6A7288]">
            Adoption rate: {adoption.rate}% ({adoption.accepted} accepted, {adoption.rejected} rejected)
          </p>
        ) : null}

        {!hasRepoActivity ? (
          <p className="mt-3 text-[12px] text-[#6A7288]">Add commits or code to your repos to unlock personalized learning steps.</p>
        ) : null}

        {hasRepoActivity && !loading && steps.length === 0 ? (
          <p className="mt-3 text-[12px] text-[#6A7288]">
            {pathError || "No personalized steps yet. Add more repos or refresh your insights."}
          </p>
        ) : null}

        <div className="mt-3 space-y-3">
          {steps.map((step, index) => {
            const feedbackKey = `${index}-${step.title}`
            const stepFeedback = feedback[feedbackKey] || {}
            const resources = stepResources[feedbackKey] || []
            const grouped = groupByKind(resources)
            const statusChip = step.status === "done" ? "Done" : "To do"
            return (
              <article key={feedbackKey} className="rounded-[10px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Step {index + 1}</p>
                <p className="mt-1 text-[14px] font-medium text-[#2A3145]">{step.title}</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">{step.reason}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#EEEDFE] px-2 py-1 text-[10px] text-[#3C3489]">{statusChip}</span>
                  {step.difficulty ? (
                    <span className="rounded-full bg-[#F1F3FA] px-2 py-1 text-[10px] text-[#5F6680]">{step.difficulty}</span>
                  ) : null}
                  {typeof step.reward_xp === "number" ? (
                    <span className="rounded-full bg-[#E9F8F2] px-2 py-1 text-[10px] text-[#0F6E56]">{step.reward_xp} XP</span>
                  ) : null}
                  {(step.tags || []).map((tag) => (
                    <span key={`${feedbackKey}-${tag}`} className="rounded-full bg-[#F1F3FA] px-2 py-1 text-[10px] text-[#5F6680]">
                      {tag}
                    </span>
                  ))}
                  {(step.evidence || []).map((ev) => (
                    <span key={`${feedbackKey}-${ev}`} className="rounded-full bg-[#FFF4E8] px-2 py-1 text-[10px] text-[#BA7517]">
                      {ev}
                    </span>
                  ))}
                  {step.tag ? (
                    <span className="rounded-full bg-[#EDF0F6] px-2 py-1 text-[10px] text-[#5F6680]">{step.tag}</span>
                  ) : null}
                </div>

                <div className="mt-3">
                  <p className="text-[12px] font-medium text-[#2A3145]">Suggested resources</p>
                  {grouped.certifications.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Certifications</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {grouped.certifications.map((resource) => (
                          <a
                            key={`${feedbackKey}-${resource.url}`}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#cbd6f2] bg-white px-2 py-1 text-[10px] text-[#2E3550] transition hover:border-[#a6b7ea]"
                            title={resource.note || ""}
                          >
                            <span className="rounded-full bg-[#EEF2FF] px-1.5 py-0.5 text-[9px] text-[#3730a3]">{kindLabel(resource.kind)}</span>
                            <span>{resource.label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {grouped.courses.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Courses</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {grouped.courses.map((resource) => (
                          <a
                            key={`${feedbackKey}-${resource.url}`}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#cbd6f2] bg-white px-2 py-1 text-[10px] text-[#2E3550] transition hover:border-[#a6b7ea]"
                            title={resource.note || ""}
                          >
                            <span className="rounded-full bg-[#F1F3FA] px-1.5 py-0.5 text-[9px] text-[#5F6680]">{kindLabel(resource.kind)}</span>
                            <span>{resource.label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {grouped.skills.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Skills</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {grouped.skills.map((resource) => (
                          <a
                            key={`${feedbackKey}-skill-${resource.id}`}
                            href={learningPathSkillHref(step, resource)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#cbd6f2] bg-white px-2 py-1 text-[10px] text-[#2E3550] transition hover:border-[#a6b7ea]"
                            title={
                              resource.note
                                ? `${resource.note} - Opens practice search for this step: ${step.title || "your path"}`
                                : `Opens practice search for this step: ${step.title || "your path"}`
                            }
                          >
                            <span className="rounded-full bg-[#ECFDF5] px-1.5 py-0.5 text-[9px] text-[#166534]">{kindLabel(resource.kind)}</span>
                            <span>{resource.label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!auth.token || stepSavingKey === feedbackKey}
                    className={`rounded-[8px] px-3 py-1.5 text-[11px] ${
                      step.status === "done" ? "bg-[#0F6E56] text-white" : "border border-[#9cdabf] bg-[#ecfdf3] text-[#0F6E56]"
                    } disabled:opacity-60`}
                    onClick={async () => {
                      if (!auth.token || !step.title) return
                      setStepSavingKey(feedbackKey)
                      try {
                        await updateLearningStepStatus(auth.token, {
                          learning_step: step.title,
                          status: "done",
                        })
                        await refreshLearningPath()
                      } finally {
                        setStepSavingKey("")
                      }
                    }}
                  >
                    {stepSavingKey === feedbackKey && step.status !== "done" ? "Saving..." : "Mark as Done"}
                  </button>
                  <button
                    type="button"
                    disabled={!auth.token || stepSavingKey === feedbackKey || step.status === "todo"}
                    className="rounded-[8px] border border-[#cbd6f2] bg-white px-3 py-1.5 text-[11px] text-[#2E3550] disabled:opacity-60"
                    onClick={async () => {
                      if (!auth.token || !step.title) return
                      setStepSavingKey(feedbackKey)
                      try {
                        await updateLearningStepStatus(auth.token, {
                          learning_step: step.title,
                          status: "todo",
                        })
                        await refreshLearningPath()
                      } finally {
                        setStepSavingKey("")
                      }
                    }}
                  >
                    {stepSavingKey === feedbackKey && step.status === "done" ? "Saving..." : "Undo"}
                  </button>
                  <button
                    type="button"
                    className={`rounded-[8px] px-3 py-1.5 text-[11px] ${
                      stepFeedback.decision === "accepted" ? "bg-[#0F6E56] text-white" : "border border-[#cbd6f2] bg-white text-[#2E3550]"
                    }`}
                    onClick={() => {
                      setFeedback((prev) => ({
                        ...prev,
                        [feedbackKey]: { ...prev[feedbackKey], decision: "accepted" },
                      }))
                      void logStepAction(step, "accepted")
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className={`rounded-[8px] px-3 py-1.5 text-[11px] ${
                      stepFeedback.decision === "rejected" ? "bg-[#A32D2D] text-white" : "border border-[#cbd6f2] bg-white text-[#2E3550]"
                    }`}
                    onClick={() => {
                      setFeedback((prev) => ({
                        ...prev,
                        [feedbackKey]: { ...prev[feedbackKey], decision: "rejected" },
                      }))
                      void logStepAction(step, "rejected")
                    }}
                  >
                    Reject
                  </button>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={`${feedbackKey}-rate-${score}`}
                      type="button"
                      className={`rounded-[8px] px-2 py-1 text-[11px] ${
                        stepFeedback.rating === score ? "bg-[linear-gradient(120deg,#4f46e5,#6366f1)] text-white" : "border border-[#cbd6f2] bg-white text-[#2E3550]"
                      }`}
                      onClick={() => {
                        setFeedback((prev) => ({
                          ...prev,
                          [feedbackKey]: { ...prev[feedbackKey], rating: score },
                        }))
                        void logStepAction(step, "rated", score)
                      }}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

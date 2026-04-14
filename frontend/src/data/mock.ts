import type {
  Badge,
  CareerSuggestion,
  LeaderboardEntry,
  PracticeDimension,
  RepoSummary,
  UserProfile,
} from "../types"

export const profile: UserProfile = {
  username: "nova-dev",
  displayName: "Nova Nguyen",
  bio: "Full-stack student building AI-first products with a love for clean UX.",
  avatarUrl:
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=160&h=160&q=80",
  level: 12,
  xp: 4860,
  nextLevelXp: 6200,
  streakDays: 19,
}

export const practiceDimensions: PracticeDimension[] = [
  {
    id: "frontend-craft",
    label: "Frontend Craft",
    confidence: 86,
    evidence: ["React + TS repos", "Component libraries", "Framer Motion usage"],
  },
  {
    id: "ai-integration",
    label: "AI Integration",
    confidence: 73,
    evidence: ["Prompt tooling", "LLM pipelines", "Vector search experiments"],
  },
  {
    id: "backend-systems",
    label: "Backend Systems",
    confidence: 64,
    evidence: ["FastAPI services", "Postgres schema work", "API testing suites"],
  },
  {
    id: "product-design",
    label: "Product Design",
    confidence: 58,
    evidence: ["Design systems", "UX experiments", "Storybook workflows"],
  },
]

export const careerSuggestions: CareerSuggestion[] = [
  {
    id: "ai-product-engineer",
    title: "AI Product Engineer",
    confidence: 81,
    reasoning:
      "Strong UI craft paired with consistent AI experimentation suggests a fit for building AI-first user experiences.",
  },
  {
    id: "full-stack-engineer",
    title: "Full-Stack Engineer",
    confidence: 75,
    reasoning:
      "Balanced front and back-end contributions with production-ready repos aligns with end-to-end product delivery.",
  },
  {
    id: "developer-advocate",
    title: "Developer Advocate",
    confidence: 62,
    reasoning:
      "Open-source commits and documentation-heavy repos show a pattern of teaching and community building.",
  },
]

export const badges: Badge[] = [
  {
    id: "commit-sprint",
    label: "Commit Sprint",
    description: "7-day consecutive commit streak.",
    criteria: "Commit at least once for 7 straight days.",
    rarity: "common",
  },
  {
    id: "polyglot",
    label: "Polyglot Builder",
    description: "Active work across 4+ languages.",
    criteria: "Ship 3+ repos using 4 distinct languages.",
    rarity: "rare",
  },
  {
    id: "open-source",
    label: "Open Source Surge",
    description: "Meaningful contributions to community repos.",
    criteria: "Merge 10+ PRs in public repositories.",
    rarity: "epic",
  },
]

export const featuredRepos: RepoSummary[] = [
  {
    id: "repo-1",
    name: "ai-study-buddy",
    description: "AI tutor that turns lectures into adaptive quizzes.",
    language: "TypeScript",
    stars: 128,
    lastUpdated: "2 days ago",
  },
  {
    id: "repo-2",
    name: "design-system-lab",
    description: "Component library with theming and motion tokens.",
    language: "CSS",
    stars: 94,
    lastUpdated: "5 days ago",
  },
  {
    id: "repo-3",
    name: "focus-flow-api",
    description: "FastAPI service for task insights and streak tracking.",
    language: "Python",
    stars: 61,
    lastUpdated: "1 week ago",
  },
]

export const leaderboard: LeaderboardEntry[] = [
  {
    id: "lb-1",
    username: "nova-dev",
    avatarUrl:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=64&h=64&q=80",
    level: 12,
    xp: 4860,
    delta: "+260 XP",
  },
  {
    id: "lb-2",
    username: "pixel-sage",
    avatarUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=facearea&w=64&h=64&q=80",
    level: 14,
    xp: 5120,
    delta: "+180 XP",
  },
  {
    id: "lb-3",
    username: "cloud-aurora",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&w=64&h=64&q=80",
    level: 11,
    xp: 4630,
    delta: "+210 XP",
  },
  {
    id: "lb-4",
    username: "loop-smith",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&w=64&h=64&q=80",
    level: 10,
    xp: 4390,
    delta: "+90 XP",
  },
]

import { motion } from "framer-motion"
import type { PracticeDimension } from "../types"
import ProgressBar from "./ProgressBar"

type PathCardProps = {
  path: PracticeDimension
}

function resolveCurriculumArea(path: PracticeDimension) {
  const label = path.label.toLowerCase()
  if (label.includes("frontend") || label.includes("web") || label.includes("ui")) {
    return "Web and Application Development"
  }
  if (label.includes("backend") || label.includes("software engineering") || label.includes("api")) {
    return "Software Engineering and Backend Development"
  }
  if (label.includes("data") || label.includes("ml") || label.includes("ai")) {
    return "Data Management and Intelligent Systems"
  }
  return "Systems Administration, Networking, and DevOps"
}

function getActivities(path: PracticeDimension) {
  const label = path.label.toLowerCase()
  const primaryEvidence = path.evidence[0] || "your current stack"

  if (label.includes("frontend") || label.includes("web") || label.includes("ui")) {
    return [
      `[Beginner] Build a responsive interface using ${primaryEvidence}.`,
      "[Intermediate] Create reusable UI components with proper state handling.",
      "[Intermediate] Add accessibility, form validation, and API integration.",
      "[Advanced] Build a production-grade frontend module with tests.",
    ]
  }

  if (label.includes("backend") || label.includes("software engineering") || label.includes("api")) {
    return [
      `[Beginner] Build a REST API service using ${primaryEvidence}.`,
      "[Intermediate] Design schema + CRUD with repository/service layers.",
      "[Intermediate] Add authentication, authorization, and validation.",
      "[Advanced] Add integration tests, logging, and performance tuning.",
    ]
  }

  if (label.includes("data") || label.includes("ml") || label.includes("ai")) {
    return [
      "[Beginner] Build a data cleaning and exploratory analysis workflow.",
      "[Intermediate] Create SQL queries and dashboard-ready data outputs.",
      "[Intermediate] Train a small ML model and evaluate it properly.",
      "[Advanced] Deploy model/data services and monitor quality metrics.",
    ]
  }

  return [
    "[Beginner] Build a CLI utility for one repetitive workflow task.",
    "[Intermediate] Set up CI checks for lint, test, and build.",
    "[Intermediate] Improve observability with logs and monitoring basics.",
    "[Advanced] Create a full deployment pipeline from commit to production.",
  ]
}

export default function PathCard({ path }: PathCardProps) {
  const activities = getActivities(path)
  const curriculumArea = resolveCurriculumArea(path)

  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="rounded-2xl border border-ink/10 bg-paper/70 p-5 shadow-soft backdrop-blur"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Practice Dimension</p>
          <h3 className="mt-2 text-xl font-semibold">{path.label}</h3>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/50">Curriculum Area: {curriculumArea}</p>
        </div>
        <span className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/70">
          {path.confidence}% confident
        </span>
      </div>
      <div className="mt-4">
        <ProgressBar value={path.confidence} />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
        Activity / project list
      </p>
      <ul className="mt-3 space-y-2 text-sm text-ink/70">
        {activities.map((item, index) => (
          <li key={`${path.label}-activity-${index}`} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-neon" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

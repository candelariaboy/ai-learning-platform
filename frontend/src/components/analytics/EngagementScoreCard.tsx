import type { EngagementAnalytics } from "../../types"

type EngagementScoreCardProps = {
  score: EngagementAnalytics["engagement_score"]
}

function scoreLabel(score: number) {
  if (score >= 71) return "Highly engaged"
  if (score >= 31) return "Moderate engagement"
  return "Low engagement"
}

export default function EngagementScoreCard({ score }: EngagementScoreCardProps) {
  const label = scoreLabel(score)
  return (
    <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
      <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Engagement Score</p>
      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-3xl font-semibold">{score} / 100</h3>
        <span className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
          {label}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink/60">
        Score blends commits, completed learning steps, new repos, and XP growth.
      </p>
    </div>
  )
}

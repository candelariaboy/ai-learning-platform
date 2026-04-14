import CommitActivityChart from "./CommitActivityChart"
import EngagementScoreCard from "./EngagementScoreCard"
import LearningProgressChart from "./LearningProgressChart"
import XPGrowthChart from "./XPGrowthChart"
import type { ActivityTimelineItem, EngagementAnalytics } from "../../types"

type EngagementTrendsProps = {
  analytics: EngagementAnalytics
  timeline: ActivityTimelineItem[]
}

export default function EngagementTrends({ analytics, timeline }: EngagementTrendsProps) {
  return (
    <section className="mt-12 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Analytics</p>
        <h3 className="mt-2 text-2xl font-semibold">Engagement Trends</h3>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <EngagementScoreCard score={analytics.engagement_score} />
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Activity Timeline</p>
          <h4 className="mt-2 text-lg font-semibold">Recent engagement</h4>
          <div className="mt-4 space-y-3 text-sm text-ink/70">
            {timeline.length === 0 ? (
              <p className="text-sm text-ink/60">No activity yet.</p>
            ) : (
              timeline.slice(0, 6).map((item, index) => (
                <div
                  key={`${item.date}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-ink/10 bg-paper/60 px-3 py-2"
                >
                  <span>{item.event}</span>
                  <span className="text-xs text-ink/50">{item.date.slice(0, 10)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <CommitActivityChart data={analytics.weekly_commits} />
        <XPGrowthChart data={analytics.xp_growth} />
        <LearningProgressChart data={analytics.learning_progress} />
      </div>
    </section>
  )
}

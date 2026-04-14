import type { LeaderboardEntry } from "../types"

type LeaderboardRowProps = {
  entry: LeaderboardEntry
  rank: number
}

export default function LeaderboardRow({ entry, rank }: LeaderboardRowProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-soft">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-paper">
          <span className="text-sm font-semibold">#{rank}</span>
        </div>
        <img src={entry.avatarUrl} alt={entry.username} className="h-12 w-12 rounded-2xl" />
        <div>
          <p className="font-semibold">{entry.username}</p>
          <p className="text-xs text-ink/60">Level {entry.level}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{entry.xp} XP</p>
        <p className="text-xs text-ink/60">{entry.delta}</p>
      </div>
    </div>
  )
}

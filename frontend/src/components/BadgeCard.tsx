import { motion } from "framer-motion"
import type { Badge } from "../types"

type BadgeCardProps = {
  badge: Badge
  showStatus?: boolean
  showRarity?: boolean
  showReward?: boolean
  showCriteria?: boolean
  showDescription?: boolean
  compact?: boolean
}

const rarityStyles = {
  common: "bg-ink/10 text-ink/70",
  uncommon: "bg-[#dcedc8] text-[#1b5e20]",
  rare: "bg-neon/20 text-ink",
  epic: "bg-glow/30 text-ink",
  legendary: "bg-[#fff0b3] text-[#5a4500]",
}

export default function BadgeCard({
  badge,
  showStatus = true,
  showRarity = true,
  showReward = true,
  showCriteria = true,
  showDescription = true,
  compact = false,
}: BadgeCardProps) {
  const hasMeta = (showStatus && badge.achieved) || showRarity

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`rounded-2xl border border-ink/10 bg-paper/80 text-left shadow-soft ${compact ? "p-3" : "p-4"}`}
      style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className={`flex flex-wrap items-start gap-2 ${hasMeta ? "justify-between" : "justify-start"}`}>
        <div className="flex items-start gap-2">
          <span className={compact ? "text-base" : "text-xl"} aria-hidden>
            {badge.medal_icon || "🏅"}
          </span>
          <p
            className={`${compact ? "text-[1.02rem]" : "text-lg"} max-w-[16ch] font-semibold leading-snug tracking-[0.005em]`}
          >
            {badge.icon ? `${badge.icon} ` : ""}
            {badge.label}
          </p>
        </div>
        {hasMeta ? <div className="flex items-center gap-2"> 
          {showStatus && badge.achieved ? (
            <span className="rounded-full bg-neon/30 px-3 py-1.5 text-xs font-semibold text-ink">
              {badge.claimed ? "Claimed" : "Achieved"}
            </span>
          ) : null}
          {showRarity ? (
            <span className={`rounded-full px-3 py-1.5 text-xs ${rarityStyles[badge.rarity as keyof typeof rarityStyles] || rarityStyles.common}`}>
              {badge.rarity}
            </span>
          ) : null}
        </div> : null}
      </div>
      {showDescription ? <p className="mt-2 text-sm leading-snug text-ink/70">{badge.description}</p> : null}
      {showReward && badge.reward_xp ? (
        <p className="mt-2 text-xs font-semibold text-neon">Reward: +{badge.reward_xp} XP</p>
      ) : null}
      {showCriteria ? <p className="mt-3 text-xs text-ink/50">Criteria: {badge.criteria}</p> : null}
    </motion.div>
  )
}

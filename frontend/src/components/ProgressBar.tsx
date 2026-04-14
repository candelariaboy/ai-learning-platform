import { motion } from "framer-motion"

type ProgressBarProps = {
  value: number
  label?: string
  max?: number
}

export default function ProgressBar({ value, label, max = 100 }: ProgressBarProps) {
  const width = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between text-sm text-ink/70">
          <span>{label}</span>
          <span>{Math.round(width)}%</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-neon via-glow to-neon shadow-glow"
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

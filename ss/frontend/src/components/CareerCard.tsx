import { motion } from "framer-motion"
import type { CareerSuggestion } from "../types"
import ProgressBar from "./ProgressBar"

type CareerCardProps = {
  career: CareerSuggestion
}

export default function CareerCard({ career }: CareerCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-soft backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{career.title}</h3>
        <span className="rounded-full bg-ink/10 px-3 py-1 text-xs text-ink/70">
          {career.confidence}% match
        </span>
      </div>
      <p className="mt-3 text-sm text-ink/70">{career.reasoning}</p>
      <div className="mt-4">
        <ProgressBar value={career.confidence} label="Confidence" />
      </div>
    </motion.div>
  )
}

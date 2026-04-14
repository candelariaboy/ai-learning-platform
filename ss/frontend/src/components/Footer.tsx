export default function Footer() {
  return (
    <footer className="border-t border-[#143f19] bg-[#0f4218] py-8 text-[#FFD700]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold">LSPU AI-Enhanced Gamified Student Portfolio Platform</p>
          <p className="text-xs text-[#fff4bf]">Built for LSPU student developers: from classroom projects to thesis-ready portfolios.</p>
        </div>
        <div className="text-xs text-[#fff4bf]">
          Built with React, Tailwind, Framer Motion, FastAPI, and Supabase.
        </div>
      </div>
    </footer>
  )
}

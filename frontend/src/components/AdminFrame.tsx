import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { getStoredAdminAuth, signOutAdmin } from "../lib/api"
import NotFoundPage from "../pages/NotFoundPage"

type AdminFrameProps = {
  children: ReactNode
  /** Set false when the page renders its own top toolbar (e.g. dashboard with bound search). */
  showBuiltInToolbar?: boolean
}

/** Must stay outside AdminFrame so its identity is stable — nested components remount every parent render and break NavLink clicks. */
function AdminSidebarNavItem({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-2 pr-9 text-left text-sm font-semibold transition ${
          isActive ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/12"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative z-10 min-w-0 flex-1">{children}</span>
          {isActive ? (
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
            />
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export default function AdminFrame({ children, showBuiltInToolbar = true }: AdminFrameProps) {
  const auth = getStoredAdminAuth()
  const isFaculty = auth.role === "faculty"

  if (!auth.token) {
    return <NotFoundPage message="Sign in as staff to view this page." />
  }

  return (
    <div className="admin-app-root relative isolate min-h-screen bg-[#efe8ff] text-[#2f2647]">
      <div className="mx-auto flex min-h-screen min-w-0 max-w-[1400px] flex-col lg:flex-row">
        {/* Sidebar above main in stacking order so wide main content / shadows never steal clicks */}
        <aside className="relative z-20 w-full shrink-0 overflow-x-hidden bg-[linear-gradient(180deg,#9369ec_0%,#7f56d9_45%,#6938b7_100%)] p-4 text-white shadow-[0_20px_50px_rgba(74,47,146,0.35)] lg:min-h-screen lg:w-[260px] lg:max-w-[260px]">
          <div className="flex h-full flex-col gap-5">
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-sm font-bold text-white">A</div>
              <div>
                <p className="text-sm font-semibold text-white">Admin Console</p>
                <p className="text-xs text-white/70">LSPU BSCS/BSIT</p>
              </div>
            </div>

            <nav className="relative z-10 space-y-1" aria-label="Admin">
              <AdminSidebarNavItem to="/admin" end>
                Home
              </AdminSidebarNavItem>
              {isFaculty ? <AdminSidebarNavItem to="/faculty">Faculty Home</AdminSidebarNavItem> : null}
              <AdminSidebarNavItem to="/admin/students">Students</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/validations">Project Validation</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/certificates">Certificate Review</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/interventions">Intervention Plans</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/intervention-alerts">Intervention Alerts</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/cohort-comparison">Cohort Comparison</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/evaluation">SUS & AI Metrics</AdminSidebarNavItem>
              <AdminSidebarNavItem to="/admin/leaderboard">Leaderboard</AdminSidebarNavItem>
            </nav>

            <div className="mt-auto">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-left text-sm text-white transition hover:bg-white/18"
                onClick={() => {
                  signOutAdmin("/")
                }}
              >
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="relative z-10 min-h-0 min-w-0 flex-1 p-4 sm:p-5">
          {showBuiltInToolbar ? (
            <>
              <div className="rounded-2xl border border-violet-100 bg-white/95 p-3 shadow-[0_12px_30px_rgba(74,47,146,0.1)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-violet-100 bg-[#f6f2ff] px-3 py-2">
                    <span className="text-sm">Search</span>
                    <input
                      placeholder="Search students, sections, analytics..."
                      className="w-full border-0 bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-lg border border-violet-100 bg-[#f8f5ff] px-3 py-2 text-xs font-semibold text-[#4b3d73]"
                    >
                      Notifications
                    </button>
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-200 text-xs font-bold text-[#4b3d73]">
                      {isFaculty ? "FC" : "AD"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#2f2647]">{auth.username || "Admin"}</p>
                      <p className="text-[11px] text-[#7e7597]">{isFaculty ? "LSPU Faculty" : "LSPU Administrator"}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5">{children}</div>
            </>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}

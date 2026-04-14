import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { clearStoredAuth, getStoredAuth, logoutAuth, pingAuth } from "../lib/api"

export default function Navbar() {
  const [auth, setAuth] = useState(() => getStoredAuth())
  const username = auth.username
  const isUserLoggedIn = Boolean(auth.token && auth.username)
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: "home" },
    { to: "/learning-paths", label: "Learning Paths", icon: "book" },
    { to: "/project-validations", label: "Project Validations", icon: "clipboard" },
    { to: "/training", label: "Training", icon: "bolt" },
    { to: "/achievements", label: "Achievements", icon: "trophy" },
    { to: "/my-portfolio", label: "Portfolio", icon: "folder" },
  ]

  function Icon({ name, active }: { name: string; active: boolean }) {
    const cls = `h-5 w-5 flex-shrink-0 ${active ? "text-white" : "text-white/70 group-hover:text-white"}`
    switch (name) {
      case "home":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 10.5L12 4l9 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "book":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "clipboard":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="7" y="4" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "bolt":
        return (
          <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor" />
          </svg>
        )
      case "trophy":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M8 3h8v3a4 4 0 01-4 4H12a4 4 0 01-4-4V3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 7a6 6 0 006 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 7a6 6 0 01-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "folder":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      default:
        return <span className={cls} />
    }
  }

  useEffect(() => {
    const stored = getStoredAuth()
    if (stored && stored.token) {
      pingAuth(stored.token).catch(() => {
        clearStoredAuth()
        setAuth({ token: "", username: "" })
      })
    }

    const onStorage = () => setAuth(getStoredAuth())
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  function toggleCollapsed() {
    setCollapsed((s) => !s)
  }

  async function handleLogout() {
    try {
      const stored = getStoredAuth()
      if (stored && stored.token) {
        await logoutAuth(stored.token)
      }
    } catch (e) {
      // ignore logout errors
    }
    clearStoredAuth()
    setAuth({ token: "", username: "" })
    window.location.href = "/"
  }

  return (
    <aside
      className={`h-full text-white transition-all duration-300 ease-in-out ${collapsed ? "w-24" : "w-[260px]"}`}
      aria-expanded={!collapsed}
    >
      <div className="relative h-full overflow-hidden rounded-tr-[18px]">
        <div className={`absolute inset-0 -z-10 devpath-gradient`} />
        <div className="absolute -left-20 -top-16 h-56 w-56 rounded-full bg-white/6 filter blur-3xl opacity-30 -z-10 animate-[lspuAuroraShift_10s_ease-in-out_infinite]" />
        <div className={`relative z-10 flex h-full flex-col py-6 ${collapsed ? "px-0" : "px-5"}`}>
          {/* Header */}
          <button
            type="button"
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`mb-6 flex w-full bg-transparent text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl ${
              collapsed ? "flex-col items-center justify-center p-2" : "flex-row items-center gap-3 p-3 justify-start"
            }`}
          >
            <img
              src="/lspu logo.png"
              alt="LSPU"
              className={`rounded-full ring-1 ring-white/20 transition-transform object-cover ${
                collapsed ? "h-14 w-14 mx-auto" : "h-14 w-14"
              }`}
            />
            {!collapsed ? <p className="text-xl font-bold">LSPU</p> : null}
          </button>

          {/* Menu */}
          <nav className="flex-1">
            <ul className="space-y-3">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={`block relative ${collapsed ? "px-2" : ""}`}>
                    {({ isActive }) => (
                      <div
                        className={`group relative flex w-full items-center rounded-xl py-2.5 transition-all duration-200 ease-in-out ${
                          isActive
                            ? "bg-white/12 text-white shadow-[0_10px_30px_rgba(79,70,229,0.16)]"
                            : "text-white/80 hover:bg-white/6 hover:text-white"
                        } ${collapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                      >
                        <span className="flex-shrink-0">
                          <Icon name={item.icon} active={isActive} />
                        </span>

                        {!collapsed ? <span className="truncate">{item.label}</span> : null}

                        {/* Active outside bulge */}
                        {!collapsed && isActive ? (
                          <AnimatePresence>
                            <motion.span
                              initial={{ opacity: 0, x: 6, scale: 0.96 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: 6, scale: 0.96 }}
                              transition={{ duration: 0.22 }}
                              className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/12 shadow-[0_8px_30px_rgba(79,70,229,0.12)]"
                            />
                          </AnimatePresence>
                        ) : null}
                      </div>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer / Controls */}
          <div className="mt-6">
            {username && !collapsed ? (
              <div className="mb-2 rounded-lg px-2 py-2 text-[12px] text-white/90">
                Signed in as <span className="font-semibold">@{username}</span>
              </div>
            ) : null}

            <div className={`flex items-center ${collapsed ? "justify-center" : ""}`}>
              {isUserLoggedIn ? (
                <button
                  onClick={handleLogout}
                  title="Logout"
                  aria-label="Logout"
                  className={`flex items-center gap-2 rounded-lg bg-white/6 border border-white/8 text-white/90 transition hover:scale-[1.02] ${collapsed ? "h-10 w-10 justify-center" : "h-10 px-3"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                    <path d="M16 17l5-5-5-5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12H9" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13 19H6a2 2 0 01-2-2V7a2 2 0 012-2h7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {!collapsed ? <span>Logout</span> : null}
                </button>
              ) : (
                <div className="h-10 w-10" />
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

import { Outlet, Route, Routes, useLocation } from "react-router-dom"
import { useEffect } from "react"
import Navbar from "./components/Navbar"
import DashboardPage from "./pages/DashboardPage"
import LandingPage from "./pages/LandingPage"
import LeaderboardPage from "./pages/LeaderboardPage"
import LearningPathsPage from "./pages/LearningPathsPage"
import ProjectValidationsPage from "./pages/ProjectValidationsPage"
import TrainingPage from "./pages/TrainingPage"
import PublicPortfolioPage from "./pages/PublicPortfolioPage"
import RegisterPage from "./pages/RegisterPage"
import AchievementsPage from "./pages/AchievementsPage"
import AdminLoginPage from "./pages/AdminLoginPage"
import AdminDashboardPage from "./pages/AdminDashboardPage"
import AdminValidationsPage from "./pages/AdminValidationsPage"
import AdminCertificatesPage from "./pages/AdminCertificatesPage"
import AdminInterventionsPage from "./pages/AdminInterventionsPage"
import AdminInterventionAlertsPage from "./pages/AdminInterventionAlertsPage"
import AdminCohortComparisonPage from "./pages/AdminCohortComparisonPage"
import AdminEvaluationPage from "./pages/AdminEvaluationPage"
import AdminStudentsPage from "./pages/AdminStudentsPage"
import FacultyLoginPage from "./pages/FacultyLoginPage"
import FacultyDashboardPage from "./pages/FacultyDashboardPage"
import {
  clearStoredAuth,
  getStoredAuth,
  markUserFirstSeen,
  pingAuth,
  setStoredAuth,
} from "./lib/api"
import NotFoundPage from "./pages/NotFoundPage"
import ReviewPortfolioPage from "./pages/ReviewPortfolioPage"

/** Nested admin routes; `key` forces correct child when URL and outlet get out of sync (RR7 edge cases). */
function AdminOutlet() {
  const { pathname } = useLocation()
  return <Outlet key={pathname} />
}

export default function App() {
  const location = useLocation()
  const isPublicPortfolio = location.pathname.startsWith("/p/")
  const isAdminRoute = location.pathname.startsWith("/admin")
  const isFacultyRoute = location.pathname.startsWith("/faculty")
  const isStaffRoute = isAdminRoute || isFacultyRoute
  const isLanding = location.pathname === "/"
  const isAdminLogin = location.pathname === "/admin-login"
  const isFacultyLogin = location.pathname === "/faculty-login"
  const isRegister = location.pathname.startsWith("/register")
  const isReview = location.pathname.startsWith("/review/")
  const showStudentSidebar =
    !isPublicPortfolio && !isStaffRoute && !isLanding && !isAdminLogin && !isFacultyLogin && !isRegister && !isReview
  const auth = getStoredAuth()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get("token") || ""
    const username = params.get("username") || ""
    const stored = getStoredAuth()
    // Accept query params only for real auth callback flows (token present).
    // Ignore standalone username query changes to avoid switching accounts unintentionally.
    if (token && username) {
      setStoredAuth(token, username)
      return
    }
    if (token && stored.username) {
      setStoredAuth(token, stored.username)
    }
  }, [location.search])

  useEffect(() => {
    const stored = getStoredAuth()
    if (!stored.username) return
    markUserFirstSeen(stored.username)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.classList.remove("dark")
    localStorage.removeItem("devpath_theme")
  }, [])

  useEffect(() => {
    if (isStaffRoute || isPublicPortfolio) {
      return
    }
    const heartbeat = () => {
      const stored = getStoredAuth()
      if (!stored.token) return
      pingAuth(stored.token).catch(() => {})
    }
    heartbeat()
    const interval = window.setInterval(heartbeat, 10000)
    return () => window.clearInterval(interval)
  }, [isStaffRoute, isPublicPortfolio, location.pathname])

  useEffect(() => {
    if (isStaffRoute || isPublicPortfolio) {
      return
    }
    const stored = getStoredAuth()
    if (!stored.token) return
    pingAuth(stored.token).catch(() => {
      clearStoredAuth()
      if (location.pathname !== "/") {
        window.location.href = "/"
      }
    })
  }, [isStaffRoute, isPublicPortfolio, location.pathname])

  const routesNode = (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/faculty-login" element={<FacultyLoginPage />} />
      <Route path="/faculty" element={<FacultyDashboardPage />} />
      <Route
        path="/dashboard"
        element={<DashboardPage />}
      />
      <Route
        path="/learning-paths"
        element={<LearningPathsPage />}
      />
      <Route path="/project-validations" element={<ProjectValidationsPage />} />
      <Route path="/training" element={<TrainingPage />} />
      <Route
        path="/achievements"
        element={<AchievementsPage />}
      />
      <Route
        path="/portfolio/:username"
        element={auth.username ? <PublicPortfolioPage mode="owner" /> : <NotFoundPage message="Sign in to view this page." />}
      />
      <Route path="/p/:username" element={<PublicPortfolioPage mode="public" />} />
      <Route
        path="/my-portfolio"
        element={<PublicPortfolioPage mode="owner" />}
      />
      <Route path="/admin/*" element={<AdminOutlet />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="validations" element={<AdminValidationsPage />} />
        <Route path="certificates" element={<AdminCertificatesPage />} />
        <Route path="interventions" element={<AdminInterventionsPage />} />
        <Route path="intervention-alerts" element={<AdminInterventionAlertsPage />} />
        <Route path="cohort-comparison" element={<AdminCohortComparisonPage />} />
        <Route path="evaluation" element={<AdminEvaluationPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
      </Route>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/review/:token" element={<ReviewPortfolioPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )

  if (showStudentSidebar) {
    return (
      <div className="app-academic-shell min-h-screen">
        <div className="lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:w-[236px]">
          <Navbar />
        </div>
        <div className="min-w-0 lg:pl-[236px]">
          {routesNode}
        </div>
      </div>
    )
  }

  // Admin UI: skip app-academic-shell fixed pseudo-layers (can interfere with clicks/stacking on some browsers).
  const outerShellClass = isStaffRoute ? "min-h-screen" : "app-academic-shell min-h-screen"
  return <div className={outerShellClass}>{routesNode}</div>
}

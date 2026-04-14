import { motion } from "framer-motion"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { adminLogin, setStoredAdminAuth } from "../lib/api"

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError("Enter your admin username and password.")
      return
    }

    setLoading(true)
    setError("")
    try {
      const result = await adminLogin({ username: username.trim(), password })
      setStoredAdminAuth(result.token || "", result.username || username.trim(), "admin")
      navigate("/admin")
    } catch (error) {
      if (error instanceof Error && error.message.trim()) {
        if (error.message === "Failed to fetch") {
          setError("Cannot connect to backend API. Start the backend server on http://localhost:8000 and try again.")
        } else {
          setError(error.message)
        }
      } else {
        setError("Admin login failed. Check credentials or contact administrator.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lspu-login-screen relative min-h-screen overflow-hidden">
      <div className="lspu-login-overlay pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full overflow-hidden rounded-[28px] border border-white/20 shadow-[0_26px_80px_rgba(8,22,26,0.52)]"
        >
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="relative overflow-hidden bg-[url('/ccs.jpg')] bg-cover bg-top px-7 py-10 sm:px-10 lg:px-12">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(170deg,rgba(110,179,106,0.6)_0%,rgba(79,174,207,0.56)_58%,rgba(47,137,213,0.6)_100%)]" />
              <div className="relative flex min-h-[520px] flex-col items-center justify-center gap-6 pb-10 pt-2 sm:pb-14 sm:pt-4">
                <div className="flex w-fit items-center justify-center rounded-full border border-white/35 bg-white/18 p-4 backdrop-blur-sm sm:p-5">
                  <img
                    src="/lspu logo.png"
                    alt="LSPU"
                    className="h-36 w-36 rounded-full object-cover shadow-[0_10px_30px_rgba(0,0,0,0.24)] sm:h-44 sm:w-44"
                  />
                </div>
                <p className="lspu-left-login-copy text-center">
                  Secure administrative access for platform oversight
                </p>
              </div>
            </div>

            <div className="relative bg-[linear-gradient(180deg,#191c21_0%,#1d2126_100%)] px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
              <div className="flex min-h-[520px] flex-col justify-start pt-2 text-center sm:pt-4">
                <div className="mx-auto mb-0 h-28 w-full max-w-[32rem] overflow-hidden sm:h-32">
                  <img
                    src="/lspu.png"
                    alt="LSPU Logo"
                    className="h-full w-full object-cover object-[center_62%]"
                  />
                </div>
                <h2 className="mx-auto -mt-5 max-w-2xl text-2xl sm:text-3xl lg:text-4xl">
                  <span className="lspu-mark-word">LSPU</span>{" "}
                  <span className="lspu-tech-brand-title">Admin Console Login</span>
                </h2>
                <p className="mt-3 text-sm text-[#8fa5b4]">
                  Sign in to manage students, validations, and analytics
                </p>
                <p className="mt-1 text-xs text-[#8fa5b4]/85">
                  Uses server credentials from <code>ADMIN_LOGIN_USERNAME</code> and <code>ADMIN_LOGIN_PASSWORD</code>.
                </p>
                <p className="mt-1 text-xs text-[#8fa5b4]/85">
                  Faculty account? <button type="button" onClick={() => navigate("/faculty-login")} className="underline">Go to faculty login</button>.
                </p>
                <div className="mx-auto mt-7 h-px w-full max-w-2xl bg-white/15" />

                <form
                  onSubmit={handleSubmit}
                  className="mx-auto mt-10 flex w-full max-w-md flex-col gap-3 text-left"
                >
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b8cbdb]">
                    Admin Username
                  </label>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    type="text"
                    placeholder="Enter admin username"
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-[#9fb2c4] outline-none transition focus:border-[#5fb8f0]/55"
                  />

                  <label className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#b8cbdb]">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Enter password"
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-[#9fb2c4] outline-none transition focus:border-[#5fb8f0]/55"
                  />

                  {error ? (
                    <div className="rounded-xl border border-rose-400/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[#0D47A1]/45 bg-[#0D47A1]/75 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0D47A1]/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Signing in..." : "Login as Admin"}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-[#d6e7ff] transition hover:bg-white/10"
                  >
                    Back to Landing
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-white/38">
                  © 2026 Laguna State Polytechnic University
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

import { motion } from "framer-motion"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { facultyLogin, setStoredAdminAuth } from "../lib/api"

export default function FacultyLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError("Enter your faculty username and password.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await facultyLogin({ username: username.trim(), password })
      setStoredAdminAuth(result.token || "", result.username || username.trim(), "faculty")
      navigate("/faculty")
    } catch (err) {
      if (err instanceof Error && err.message.trim()) {
        setError(err.message)
      } else {
        setError("Faculty login failed.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lspu-login-screen relative min-h-screen overflow-hidden">
      <div className="lspu-login-overlay pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full overflow-hidden rounded-[24px] border border-white/20 bg-[#1c2230]/95 p-6 shadow-[0_26px_80px_rgba(8,22,26,0.52)]"
        >
          <h1 className="text-2xl font-semibold text-white">Faculty Login</h1>
          <p className="mt-2 text-sm text-[#b6c5d7]">
            Use faculty credentials to access advisory dashboards and intervention tools.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 flex max-w-md flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c5d3e4]">Faculty Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-[#9fb2c4] outline-none"
              placeholder="Enter faculty username"
            />
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c5d3e4]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-[#9fb2c4] outline-none"
              placeholder="Enter password"
            />
            {error ? <p className="rounded-xl border border-rose-400/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-full bg-[#0D47A1]/85 px-6 py-3 text-sm font-semibold text-white disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Login as Faculty"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-[#d6e7ff]"
            >
              Back to Landing
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

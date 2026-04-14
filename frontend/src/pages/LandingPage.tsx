import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { getGithubLoginUrl, getStoredAuth } from "../lib/api"

export default function LandingPage() {
  const [username, setUsername] = useState("")
  const [authError, setAuthError] = useState("")
  const navigate = useNavigate()
  const location = useLocation()

  const startWithGithub = async () => {
    const url = await getGithubLoginUrl()
    window.location.href = url
  }

  useEffect(() => {
    const update = () => {
      const stored = getStoredAuth()
      setUsername(stored.token && stored.username ? stored.username : "")
    }
    update()
    window.addEventListener("storage", update)
    return () => {
      window.removeEventListener("storage", update)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const errorCode = params.get("auth_error") || ""
    if (!errorCode) {
      setAuthError("")
      return
    }
    if (errorCode === "github_oauth_failed") {
      setAuthError("GitHub login failed. Please click GitHub Login again.")
      return
    }
    if (errorCode === "github_profile_fetch_failed") {
      setAuthError("GitHub profile could not be fetched. Please retry in a few seconds.")
      return
    }
    setAuthError("Authentication failed. Please try again.")
  }, [location.search])

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
                  <img src="/lspu logo.png" alt="LSPU" className="h-36 w-36 rounded-full object-cover shadow-[0_10px_30px_rgba(0,0,0,0.24)] sm:h-44 sm:w-44" />
                </div>
                <p className="lspu-left-login-copy text-center">Sign in with your GitHub account</p>
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
                  <span className="lspu-tech-brand-title">AI-Enhanced Gamified Student Portfolio Platform</span>
                </h2>
                <p className="mt-3 text-sm text-[#8fa5b4]">Gamified growth for BSCS & BSIT students</p>
                <div className="mx-auto mt-7 h-px w-full max-w-2xl bg-white/15" />

                                <div className="mx-auto mt-10 w-full max-w-md">
                  <div className="grid w-full gap-3 sm:grid-cols-2">
                    <button
                      onClick={startWithGithub}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#5fb8f0]/42 bg-[#188bc6] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(24,139,198,0.35)] transition hover:-translate-y-0.5"
                    >
                      <span className="text-base leading-none">◉</span>
                      GitHub Login
                    </button>
                    <button
                      onClick={() => navigate("/admin-login")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(8,22,26,0.28)] transition hover:-translate-y-0.5 hover:bg-white/18"
                    >
                      Admin Login
                    </button>
                  </div>
                </div>

                {authError ? (
                  <p className="mx-auto mt-3 w-full max-w-md rounded-xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-200">
                    {authError}
                  </p>
                ) : null}

                {username ? (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="mx-auto mt-4 inline-flex w-full max-w-md items-center justify-center rounded-full border border-[#53cb95]/35 bg-[#136143]/36 px-6 py-3 text-sm font-semibold text-[#c7ffe5] transition hover:bg-[#136143]/48"
                  >
                    Continue as {username}
                  </button>
                ) : null}

                <p className="mt-8 text-center text-sm text-white/38">© 2026 Laguna State Polytechnic University</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}


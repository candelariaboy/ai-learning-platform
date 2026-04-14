import { Link } from "react-router-dom"

type NotFoundPageProps = {
  message?: string
}

export default function NotFoundPage({ message = "This page is not available." }: NotFoundPageProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-3xl border border-ink/10 bg-paper/80 p-8 text-center shadow-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Not Found</h1>
        <p className="mt-3 text-sm text-ink/70">{message}</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink/80"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}

import Image from "next/image"
import Link from "next/link"
import { franchise, seasonName } from "@/lib/history"
import { cn } from "@/lib/utils"

/** Franchise name (as it was called that season, if a year is given) linking to its franchise page. */
export function TeamLink({
  id,
  year,
  logo = false,
  className,
}: {
  id: string | null | undefined
  year?: number
  logo?: boolean
  className?: string
}) {
  const f = franchise(id)
  if (!f) return <span className={className}>Unknown</span>
  const label = year ? seasonName(f.id, year) : f.name
  return (
    <Link href={`/history/franchises/${f.id}`} className={cn("inline-flex items-center gap-2 hover:text-green-700 hover:underline", className)}>
      {logo && <TeamLogo id={f.id} size={20} />}
      <span>{label}</span>
      {year && label !== f.name && <span className="text-xs text-muted-foreground">({f.name})</span>}
    </Link>
  )
}

export function TeamLogo({ id, size = 32, className }: { id: string; size?: number; className?: string }) {
  const f = franchise(id)
  if (f?.logo) {
    return <Image src={f.logo} alt="" width={size} height={size} className={cn("rounded object-cover shrink-0", className)} style={{ width: size, height: size }} />
  }
  const initials = (f?.name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded bg-gray-200 text-gray-600 font-semibold", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
    >
      {initials}
    </span>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2">{title}</h1>
      {subtitle && <p className="text-lg text-gray-600">{subtitle}</p>}
      {children}
    </div>
  )
}

export function DataNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</p>
}

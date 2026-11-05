"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const items = [
  { href: "/history", label: "Overview" },
  { href: "/history/dashboard", label: "Dashboard" },
  { href: "/history/seasons", label: "Seasons" },
  { href: "/history/franchises", label: "Franchises" },
  { href: "/history/records", label: "Record Book" },
  { href: "/history/head-to-head", label: "Head to Head" },
  { href: "/history/auctions", label: "Auctions" },
]

export function HistoryNav() {
  const pathname = usePathname()
  return (
    <div className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto py-2 -mx-1" aria-label="History sections">
          {items.map((item) => {
            const active = item.href === "/history" ? pathname === "/history" : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-green-600 text-white" : "text-gray-700 hover:bg-green-50 hover:text-green-700"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

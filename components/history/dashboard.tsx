"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// ---------------------------------------------------------------------------
// Data contract (built on the server in app/history/dashboard/page.tsx)
// ---------------------------------------------------------------------------
export type DashboardData = {
  firstYear: number
  lastYear: number
  franchises: Array<{ id: string; name: string; logo: string | null; active: boolean; first: number; last: number }>
  teamSeasons: Array<{
    y: number; f: number; name: string; W: number; L: number; T: number; PF: number; PA: number | null
    rr: number; fin: number | null; ch: number; ru: boolean; n: number
  }>
  /** [year, week, post(0/1), awayIdx, homeIdx, awayPts, homePts] */
  games: Array<[number, number, number, number, number, number, number]>
  auctions: Array<{
    year: number; QB: number; RB: number; WR: number; TE: number; K: number; DST: number
    top: Array<{ player: string; pos: string | null; salary: number; f: number | null }>
  }>
}

// ---------------------------------------------------------------------------
// Palette (validated: scripts/validate_palette.js, light mode, #ffffff surface).
// Slots 1-4 identify focused franchises in the order they were picked; a
// franchise keeps its slot until it is removed. Slots 1-6 identify positions.
// ---------------------------------------------------------------------------
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
const POS = ["QB", "RB", "WR", "TE", "K", "DST"] as const
const POS_COLOR: Record<(typeof POS)[number], string> = {
  QB: "#2a78d6",
  RB: "#eb6834",
  WR: "#1baf7a",
  TE: "#eda100",
  K: "#e87ba4",
  DST: "#008300",
}
const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", context: "#d4d2cb", surface: "#ffffff" }
const DIV = { pos: "#2a78d6", neg: "#e34948", mid: "#f0efec" }
// Diverging steps for the head-to-head heatmap: red arm -> gray -> blue arm.
const DIV_STEPS = ["#e34948", "#ee9190", "#f0efec", "#86b6ef", "#2a78d6"]

const MAX_FOCUS = 4
const DEFAULT_FOCUS = ["masters-of-disaster", "leeds-united", "generals", "munich-cowboys"]

type Focus = Array<{ id: string; slot: number }>
type TipLine = { label: string; value: string; color?: string }
type Tip = { x: number; y: number; title: string; lines: TipLine[] } | null

// ---------------------------------------------------------------------------
export function HistoryDashboard({ data }: { data: DashboardData }) {
  const { franchises, firstYear, lastYear } = data
  const presets = useMemo(
    () => [
      { key: "all", label: "All-time", from: firstYear, to: lastYear },
      { key: "weekly", label: "2003+ (weekly scores)", from: 2003, to: lastYear },
      { key: "auction", label: "Auction era (2010+)", from: 2010, to: lastYear },
      { key: "last10", label: "Last 10 seasons", from: lastYear - 9, to: lastYear },
      { key: "last5", label: "Last 5 seasons", from: lastYear - 4, to: lastYear },
      { key: "early", label: "Early years (1994–2002)", from: firstYear, to: 2002 },
    ],
    [firstYear, lastYear]
  )

  const [from, setFrom] = useState(firstYear)
  const [to, setTo] = useState(lastYear)
  const [focus, setFocus] = useState<Focus>(DEFAULT_FOCUS.map((id, slot) => ({ id, slot })))
  const [includePost, setIncludePost] = useState(true)
  const [activeOnly, setActiveOnly] = useState(true)
  const [tip, setTip] = useState<Tip>(null)

  // Read filters from the URL once, then keep the URL in sync so views are shareable.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const f = Number(q.get("from"))
    const t = Number(q.get("to"))
    if (f >= firstYear && f <= lastYear) setFrom(f)
    if (t >= firstYear && t <= lastYear) setTo(t)
    if (q.has("focus")) {
      const ids = (q.get("focus") || "").split(",").filter((id) => franchises.some((x) => x.id === id)).slice(0, MAX_FOCUS)
      setFocus(ids.map((id, slot) => ({ id, slot })))
    }
    if (q.get("post") === "0") setIncludePost(false)
    if (q.get("active") === "0") setActiveOnly(false)
  }, [firstYear, lastYear, franchises])

  useEffect(() => {
    const q = new URLSearchParams()
    if (from !== firstYear) q.set("from", String(from))
    if (to !== lastYear) q.set("to", String(to))
    const ids = [...focus].sort((a, b) => a.slot - b.slot).map((x) => x.id).join(",")
    if (ids !== DEFAULT_FOCUS.join(",")) q.set("focus", ids)
    if (!includePost) q.set("post", "0")
    if (!activeOnly) q.set("active", "0")
    const qs = q.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [from, to, focus, includePost, activeOnly, firstYear, lastYear])

  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const focusColor = useCallback(
    (fid: string) => {
      const x = focus.find((f) => f.id === fid)
      return x ? SLOTS[x.slot] : null
    },
    [focus]
  )
  const toggleFocus = (id: string) => {
    setFocus((cur) => {
      if (cur.some((f) => f.id === id)) return cur.filter((f) => f.id !== id)
      if (cur.length >= MAX_FOCUS) return cur
      const used = new Set(cur.map((f) => f.slot))
      const slot = [0, 1, 2, 3].find((s) => !used.has(s))!
      return [...cur, { id, slot }]
    })
  }

  const showTip = (e: React.MouseEvent | React.FocusEvent, title: string, lines: TipLine[]) => {
    if ("clientX" in e) setTip({ x: e.clientX, y: e.clientY, title, lines })
    else {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setTip({ x: r.left + r.width / 2, y: r.top, title, lines })
    }
  }
  const hideTip = () => setTip(null)
  const tipProps = (title: string, lines: TipLine[]) => ({
    onMouseMove: (e: React.MouseEvent) => showTip(e, title, lines),
    onMouseLeave: hideTip,
    onFocus: (e: React.FocusEvent) => showTip(e, title, lines),
    onBlur: hideTip,
    tabIndex: 0,
  })

  // -------------------------------------------------------------------------
  // Derived slices — every chart below reads from these, so they always agree.
  // -------------------------------------------------------------------------
  const d = useMemo(() => {
    const fid = (i: number) => franchises[i].id
    const seasons = data.teamSeasons.filter((s) => s.y >= lo && s.y <= hi)
    const years = [...new Set(seasons.map((s) => s.y))].sort((a, b) => a - b)
    const allGames = data.games.filter((g) => g[0] >= lo && g[0] <= hi)
    const games = allGames.filter((g) => includePost || g[2] === 0)
    const regGames = allGames.filter((g) => g[2] === 0)
    const inScope = (i: number) => !activeOnly || franchises[i].active

    // --- per-franchise aggregates ---
    type Agg = {
      i: number; id: string; name: string; seasons: number; W: number; L: number; T: number; PF: number; G: number
      PA: number; GA: number; titles: number; finals: number; rankSum: number; bestRank: number
      apW: number; apG: number; luck: number; postW: number; postL: number; high: number
    }
    const agg = new Map<number, Agg>()
    const get = (i: number) => {
      let a = agg.get(i)
      if (!a) {
        a = { i, id: fid(i), name: franchises[i].name, seasons: 0, W: 0, L: 0, T: 0, PF: 0, G: 0, PA: 0, GA: 0, titles: 0, finals: 0, rankSum: 0, bestRank: 99, apW: 0, apG: 0, luck: 0, postW: 0, postL: 0, high: 0 }
        agg.set(i, a)
      }
      return a
    }
    for (const s of seasons) {
      const a = get(s.f)
      a.seasons++
      a.W += s.W; a.L += s.L; a.T += s.T
      a.PF += s.PF; a.G += s.W + s.L + s.T
      if (s.PA != null) { a.PA += s.PA; a.GA += s.W + s.L + s.T }
      a.titles += s.ch
      if (s.ch || s.ru) a.finals++
      a.rankSum += s.rr
      a.bestRank = Math.min(a.bestRank, s.rr)
    }

    // --- all-play ("expected") wins per team-season from regular-season weeks ---
    const weekKey = (g: (typeof regGames)[number]) => `${g[0]}-${g[1]}`
    const weeks = new Map<string, Array<[number, number]>>()
    for (const g of regGames) {
      const k = weekKey(g)
      if (!weeks.has(k)) weeks.set(k, [])
      weeks.get(k)!.push([g[3], g[5]], [g[4], g[6]])
    }
    const apSeason = new Map<string, { exp: number; act: number; g: number }>()
    for (const [k, scores] of weeks) {
      const year = Number(k.split("-")[0])
      for (const [t, p] of scores) {
        let beat = 0
        for (const [u, q] of scores) if (u !== t) beat += p > q ? 1 : p === q ? 0.5 : 0
        const share = beat / (scores.length - 1)
        const key = `${year}|${t}`
        const r = apSeason.get(key) ?? { exp: 0, act: 0, g: 0 }
        r.exp += share
        r.g++
        apSeason.set(key, r)
        const a = get(t)
        a.apW += share
        a.apG++
      }
    }
    for (const g of regGames) {
      for (const [t, p, q] of [[g[3], g[5], g[6]], [g[4], g[6], g[5]]] as const) {
        const r = apSeason.get(`${g[0]}|${t}`)
        if (r) r.act += p > q ? 1 : p === q ? 0.5 : 0
      }
    }
    for (const [key, r] of apSeason) {
      const t = Number(key.split("|")[1])
      get(t).luck += r.act - r.exp
    }
    const luckSeasons = [...apSeason.entries()].map(([key, r]) => {
      const [y, t] = key.split("|").map(Number)
      const s = data.teamSeasons.find((x) => x.y === y && x.f === t)
      return { y, f: t, name: s?.name ?? franchises[t].name, act: r.act, exp: r.exp, luck: r.act - r.exp, champ: (s?.ch ?? 0) > 0 }
    })

    // --- game-level stats ---
    let high = { pts: -1, f: 0, y: 0, w: 0, opp: 0, oppPts: 0 }
    let blow = { m: -1, w: 0, l: 0, wp: 0, lp: 0, y: 0, wk: 0 }
    let ties = 0
    let scoreSum = 0
    const scores: number[] = []
    for (const g of games) {
      const [y, wk, post, a, h, ap, hp] = g
      scores.push(ap, hp)
      scoreSum += ap + hp
      if (ap === hp) ties++
      if (ap > high.pts) high = { pts: ap, f: a, y, w: wk, opp: h, oppPts: hp }
      if (hp > high.pts) high = { pts: hp, f: h, y, w: wk, opp: a, oppPts: ap }
      const m = Math.abs(ap - hp)
      if (m > blow.m) blow = { m, w: ap >= hp ? a : h, l: ap >= hp ? h : a, wp: Math.max(ap, hp), lp: Math.min(ap, hp), y, wk }
      for (const [t, p, q] of [[a, ap, hp], [h, hp, ap]] as const) {
        const x = get(t)
        x.high = Math.max(x.high, p)
        if (post) { if (p > q) x.postW++; else if (p < q) x.postL++ }
      }
    }
    scores.sort((a, b) => a - b)
    const median = scores.length ? scores[Math.floor(scores.length / 2)] : 0

    // histogram, 10-point bins
    const binMax = Math.max(130, Math.ceil((scores[scores.length - 1] ?? 0) / 10) * 10)
    const hist = []
    for (let b = 0; b < binMax; b += 10) {
      const count = scores.filter((s) => s >= b && s < b + 10).length
      hist.push({ bin: `${b}–${b + 9}`, lo: b, count, share: scores.length ? count / scores.length : 0 })
    }

    // --- scoring by season (from standings, so it covers every year) ---
    const scoring = years.map((y) => {
      const rows = seasons.filter((s) => s.y === y)
      const ppg = rows.map((s) => s.PF / Math.max(1, s.W + s.L + s.T))
      const row: Record<string, number | [number, number] | null> = {
        year: y,
        avg: round(rows.reduce((a, s) => a + s.PF, 0) / Math.max(1, rows.reduce((a, s) => a + s.W + s.L + s.T, 0)), 1),
        range: [round(Math.min(...ppg), 1), round(Math.max(...ppg), 1)],
      }
      for (const f of focus) {
        const s = rows.find((x) => fid(x.f) === f.id)
        row[f.id] = s ? round(s.PF / Math.max(1, s.W + s.L + s.T), 1) : null
      }
      return row
    })

    // --- regular-season rank by season (bump) ---
    const ranks = years.map((y) => {
      const row: Record<string, number | null> = { year: y }
      for (const f of focus) {
        const s = seasons.find((x) => x.y === y && fid(x.f) === f.id)
        row[f.id] = s ? s.rr : null
      }
      return row
    })
    const maxTeams = Math.max(10, ...seasons.map((s) => s.n))

    // --- titles strip ---
    const champsByYear = years.map((y) => ({
      y,
      champs: seasons.filter((s) => s.y === y && s.ch > 0).map((s) => ({ f: s.f, name: s.name, co: s.ch < 1 })),
      ru: seasons.find((s) => s.y === y && s.ru) ?? null,
    }))

    const list = [...agg.values()].filter((a) => inScope(a.i))

    // --- head to head (inside range, honoring the postseason toggle) ---
    const h2hTeams = list.filter((a) => a.apG > 0).sort((a, b) => a.name.localeCompare(b.name)).map((a) => a.i)
    const h2h = new Map<string, { W: number; L: number; T: number }>()
    for (const g of games) {
      const [, , , a, h, ap, hp] = g
      for (const [x, y, p, q] of [[a, h, ap, hp], [h, a, hp, ap]] as const) {
        const k = `${x}|${y}`
        const r = h2h.get(k) ?? { W: 0, L: 0, T: 0 }
        if (p > q) r.W++; else if (p < q) r.L++; else r.T++
        h2h.set(k, r)
      }
    }

    const auctions = data.auctions.filter((a) => a.year >= lo && a.year <= hi)

    return {
      seasons, years, games, regGames, list, high, blow, ties, median, hist, scoring, ranks, maxTeams,
      champsByYear, luckSeasons, h2hTeams, h2h, auctions,
      avgScore: scores.length ? scoreSum / scores.length : 0,
      titleCount: champsByYear.filter((c) => c.champs.length).length,
      distinctChamps: new Set(champsByYear.flatMap((c) => c.champs.map((x) => x.f))).size,
    }
  }, [data, franchises, lo, hi, includePost, activeOnly, focus])

  const name = (i: number) => franchises[i].name
  const noWeekly = d.games.length === 0
  const rangeLabel = lo === hi ? String(lo) : `${lo}–${hi}`
  const preset = presets.find((p) => p.from === lo && p.to === hi)?.key

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl sm:text-4xl font-bold">History Dashboard</h1>
        <p className="text-gray-600">
          Pick an era and up to four franchises. Every number and chart on the page updates to match.
        </p>
      </div>

      {/* ------------------------------------------------------------- Filters */}
      <div className="lg:sticky lg:top-16 z-30 -mx-4 sm:mx-0 border-y sm:border sm:rounded-lg bg-white/95 backdrop-blur px-4 py-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mr-1">Era</span>
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => { setFrom(p.from); setTo(p.to) }}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${preset === p.key ? "border-green-600 bg-green-600 text-white" : "border-gray-200 hover:bg-green-50"}`}
              aria-pressed={preset === p.key}
            >
              {p.label}
            </button>
          ))}
          <span className="flex items-center gap-1 text-sm">
            <label className="sr-only" htmlFor="dash-from">From</label>
            <select id="dash-from" value={from} onChange={(e) => setFrom(Number(e.target.value))} className="rounded border border-gray-200 px-2 py-1 bg-white">
              {range(firstYear, lastYear).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-muted-foreground">to</span>
            <label className="sr-only" htmlFor="dash-to">To</label>
            <select id="dash-to" value={to} onChange={(e) => setTo(Number(e.target.value))} className="rounded border border-gray-200 px-2 py-1 bg-white">
              {range(firstYear, lastYear).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mr-1">Focus</span>
          {franchises
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => f.active || !activeOnly || focus.some((x) => x.id === f.id))
            .sort((a, b) => Number(b.f.active) - Number(a.f.active) || a.f.name.localeCompare(b.f.name))
            .map(({ f }) => {
              const c = focusColor(f.id)
              const full = !c && focus.length >= MAX_FOCUS
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFocus(f.id)}
                  disabled={full}
                  aria-pressed={!!c}
                  title={full ? "Up to four franchises at once. Remove one first." : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${c ? "border-gray-900 bg-gray-900 text-white" : full ? "border-gray-100 text-gray-300" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c ?? "transparent", boxShadow: c ? "0 0 0 2px #fff" : `inset 0 0 0 1.5px ${INK.axis}` }} />
                  {f.name}
                </button>
              )
            })}
          {focus.length > 0 && (
            <button onClick={() => setFocus([])} className="text-sm text-green-700 hover:underline ml-1">Clear</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includePost} onChange={(e) => setIncludePost(e.target.checked)} className="accent-green-600" />
            Include postseason games
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="accent-green-600" />
            Active franchises only
          </label>
          <span className="text-muted-foreground">
            Showing <b className="text-gray-900">{rangeLabel}</b> · {d.years.length} seasons · {fmt(d.games.length)} games with scores
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Seasons" value={String(d.years.length)} sub={rangeLabel} />
        <Kpi label="Titles awarded" value={String(d.titleCount)} sub={`${d.distinctChamps} different champions`} />
        <Kpi label="Games with scores" value={fmt(d.games.length)} sub={noWeekly ? "None on file before 2003" : `${d.ties} ties`} />
        <Kpi label="Avg team score" value={noWeekly ? "—" : d.avgScore.toFixed(1)} sub={noWeekly ? "Needs weekly data" : `Median ${d.median}`} />
        <Kpi
          label="High score"
          value={noWeekly ? "—" : String(d.high.pts)}
          sub={noWeekly ? "Needs weekly data" : `${name(d.high.f)}, ${d.high.y} wk ${d.high.w}`}
        />
        <Kpi
          label="Biggest blowout"
          value={noWeekly ? "—" : `+${d.blow.m}`}
          sub={noWeekly ? "Needs weekly data" : `${name(d.blow.w)} ${d.blow.wp}–${d.blow.lp}, ${d.blow.y}`}
        />
      </div>

      {/* ----------------------------------------------------- Scoring + ranks */}
      <div className="grid xl:grid-cols-2 gap-6">
        <Panel title="Points per game by season" note="Gray band: lowest to highest team in the league that year. Black: league average. From season standings, so it covers every year.">
          <Legend
            items={[
              { label: "League average", color: INK.primary, kind: "line" },
              { label: "Team range", color: INK.context, kind: "box" },
              ...focus.map((f) => ({ label: franchises.find((x) => x.id === f.id)!.name, color: SLOTS[f.slot], kind: "line" as const })),
            ]}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.scoring} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={INK.grid} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: INK.muted }} tickLine={false} axisLine={{ stroke: INK.axis }} minTickGap={16} />
                <YAxis tick={{ fontSize: 11, fill: INK.muted }} tickLine={false} axisLine={false} width={44} domain={[0, "auto"]} />
                <Tooltip content={<ChartTip names={franchises} focus={focus} suffix=" ppg" />} cursor={{ stroke: INK.axis, strokeWidth: 1 }} />
                <Area dataKey="range" stroke="none" fill={INK.context} fillOpacity={0.6} isAnimationActive={false} />
                <Line dataKey="avg" stroke={INK.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
                {focus.map((f) => (
                  <Line key={f.id} dataKey={f.id} stroke={SLOTS[f.slot]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Regular-season finish" note="1 = best record that season. One small chart per focused franchise, same scale. Gaps are seasons it didn't play.">
          {focus.length ? (
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
              {[...focus].sort((a, b) => a.slot - b.slot).map((f) => {
                const fr = franchises.find((x) => x.id === f.id)!
                const vals = d.ranks.map((r) => r[f.id]).filter((v): v is number => v != null)
                const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
                return (
                  <div key={f.id} className="min-w-0">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 font-medium truncate">
                        <span className="inline-block h-0.5 w-3 rounded" style={{ background: SLOTS[f.slot] }} />
                        {fr.name}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {avg ? `avg ${avg.toFixed(1)} · best ${ordinal(Math.min(...vals))}` : "no seasons"}
                      </span>
                    </div>
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={d.ranks} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                          <CartesianGrid stroke={INK.grid} vertical={false} />
                          <XAxis dataKey="year" tick={{ fontSize: 10, fill: INK.muted }} tickLine={false} axisLine={{ stroke: INK.axis }} minTickGap={24} />
                          <YAxis reversed domain={[1, d.maxTeams]} ticks={[1, 5, d.maxTeams]} tick={{ fontSize: 10, fill: INK.muted }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                          <Tooltip content={<ChartTip names={franchises} focus={[f]} ordinal />} cursor={{ stroke: INK.axis, strokeWidth: 1 }} />
                          <Line dataKey={f.id} stroke={SLOTS[f.slot]} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: SLOTS[f.slot] }} activeDot={{ r: 5, stroke: INK.surface, strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty>Pick up to four franchises in the filter bar to compare their finishes.</Empty>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------ Titles strip */}
      <Panel
        title="Who won when"
        note="Filled dot: champion. Ring: runner-up. Half dot: co-champion. Focused franchises in their color."
      >
        <TitleStrip d={d} franchises={franchises} focusColor={focusColor} tipProps={tipProps} />
      </Panel>

      {/* ------------------------------------------- Titles / win pct / luck */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title={`Titles, ${rangeLabel}`} note="Bar: titles (co-titles count ½). Number on the right: finals reached.">
          <HBarList
            rows={[...d.list].filter((a) => a.finals > 0).sort((a, b) => b.titles - a.titles || b.finals - a.finals)}
            value={(a) => a.titles}
            max={Math.max(1, ...d.list.map((a) => a.titles))}
            color={(a) => focusColor(a.id) ?? "#a3a19a"}
            label={(a) => a.name}
            right={(a) => `${fmtTitles(a.titles)} · ${a.finals}F`}
            tip={(a) => ({ title: a.name, lines: [{ label: "Titles", value: fmtTitles(a.titles) }, { label: "Finals", value: String(a.finals) }, { label: "Seasons", value: String(a.seasons) }] })}
            tipProps={tipProps}
            empty="No titles in this range."
          />
        </Panel>

        <Panel title="Win percentage vs .500" note="Regular season. Blue above .500, red below.">
          <DivergingList
            rows={[...d.list].sort((a, b) => pctOf(b) - pctOf(a))}
            value={(a) => pctOf(a) - 0.5}
            max={Math.max(0.05, ...d.list.map((a) => Math.abs(pctOf(a) - 0.5)))}
            label={(a) => a.name}
            right={(a) => pctStr(pctOf(a))}
            bold={(a) => !!focusColor(a.id)}
            tip={(a) => ({ title: a.name, lines: [{ label: "Record", value: rec(a) }, { label: "Win pct", value: pctStr(pctOf(a)) }, { label: "Seasons", value: String(a.seasons) }] })}
            tipProps={tipProps}
          />
        </Panel>

        <Panel title="Luck: wins vs. all-play wins" note="All-play: how often a team's weekly score would have beaten everyone else that week. Positive = won more than its scores earned. 2003+ only.">
          {d.regGames.length ? (
            <DivergingList
              rows={[...d.list].filter((a) => a.apG > 0).sort((a, b) => b.luck - a.luck)}
              value={(a) => a.luck}
              max={Math.max(1, ...d.list.map((a) => Math.abs(a.luck)))}
              label={(a) => a.name}
              right={(a) => signed(a.luck, 1)}
              bold={(a) => !!focusColor(a.id)}
              tip={(a) => ({
                title: a.name,
                lines: [
                  { label: "Actual wins", value: (a.W + 0.5 * a.T).toFixed(1) },
                  { label: "All-play wins", value: a.apW.toFixed(1) },
                  { label: "All-play pct", value: pctStr(a.apW / Math.max(1, a.apG)) },
                  { label: "Luck", value: signed(a.luck, 1) },
                ],
              })}
              tipProps={tipProps}
            />
          ) : (
            <Empty>No weekly scores in this range (they start in 2003).</Empty>
          )}
        </Panel>
      </div>

      {/* ------------------------------------- Score distribution + lucky seasons */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="How teams score" note={`Every team score in the range, in 10-point bins. Line: median (${d.median}).`}>
          {d.games.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.hist} margin={{ top: 8, right: 12, bottom: 0, left: -12 }} barCategoryGap={2}>
                  <CartesianGrid stroke={INK.grid} vertical={false} />
                  <XAxis dataKey="lo" tick={{ fontSize: 11, fill: INK.muted }} tickLine={false} axisLine={{ stroke: INK.axis }} />
                  <YAxis tick={{ fontSize: 11, fill: INK.muted }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<HistTip />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                  <ReferenceLine x={Math.floor(d.median / 10) * 10} stroke={INK.secondary} strokeWidth={1} />
                  <Bar dataKey="count" fill={SLOTS[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No weekly scores in this range (they start in 2003).</Empty>
          )}
        </Panel>

        <Panel title="Luckiest and unluckiest seasons" note="Actual wins minus all-play wins in one regular season. 🏆 = won the title anyway.">
          {d.luckSeasons.length ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Luckiest", rows: [...d.luckSeasons].sort((a, b) => b.luck - a.luck).slice(0, 6) },
                { title: "Unluckiest", rows: [...d.luckSeasons].sort((a, b) => a.luck - b.luck).slice(0, 6) },
              ].map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{group.title}</p>
                  <DivergingList
                    rows={group.rows}
                    value={(r) => r.luck}
                    max={Math.max(1, ...d.luckSeasons.map((r) => Math.abs(r.luck)))}
                    label={(r) => `${r.y} ${r.name}${r.champ ? " 🏆" : ""}`}
                    right={(r) => signed(r.luck, 1)}
                    bold={(r) => !!focusColor(franchises[r.f].id)}
                    tip={(r) => ({ title: `${r.y} ${r.name}`, lines: [{ label: "Actual wins", value: r.act.toFixed(1) }, { label: "All-play wins", value: r.exp.toFixed(1) }, { label: "Luck", value: signed(r.luck, 1) }] })}
                    tipProps={tipProps}
                    compact
                  />
                </div>
              ))}
            </div>
          ) : (
            <Empty>No weekly scores in this range (they start in 2003).</Empty>
          )}
        </Panel>
      </div>

      {/* ----------------------------------------------------------- Heatmap */}
      <Panel
        title="Head to head"
        note={`Row team's record against the column team, ${rangeLabel}${includePost ? ", including postseason" : ", regular season"}. Blue: row team leads. Red: row team trails.`}
      >
        {d.h2hTeams.length > 1 ? (
          <Heatmap d={d} franchises={franchises} focusColor={focusColor} tipProps={tipProps} />
        ) : (
          <Empty>No head-to-head games in this range (weekly scores start in 2003).</Empty>
        )}
      </Panel>

      {/* ---------------------------------------------------------- Auctions */}
      <Panel title="Where the auction money goes" note="Share of position-labeled dollars each year. 2010–2011 kickers and defenses have no label and are left out.">
        {d.auctions.length ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Legend items={POS.map((p) => ({ label: p, color: POS_COLOR[p], kind: "box" as const }))} />
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.auctions.map((a) => normalizeShares(a))} margin={{ top: 8, right: 12, bottom: 0, left: -12 }} barCategoryGap="18%">
                    <CartesianGrid stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: INK.muted }} tickLine={false} axisLine={{ stroke: INK.axis }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: INK.muted }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<PosTip />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                    {POS.map((p, i) => (
                      <Bar key={p} dataKey={p} stackId="pos" fill={POS_COLOR[p]} stroke={INK.surface} strokeWidth={2} radius={i === POS.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Top price each year</p>
              <ul className="space-y-1 text-sm max-h-72 overflow-y-auto pr-1">
                {[...d.auctions].reverse().map((a) => {
                  const p = a.top[0]
                  if (!p) return null
                  const c = p.f != null ? focusColor(franchises[p.f].id) : null
                  return (
                    <li key={a.year} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <Link href={`/history/seasons/${a.year}`} className="text-green-700 hover:underline tabular-nums">{a.year}</Link>{" "}
                        <span className="font-medium">{p.player}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {p.pos} · {c && <span className="inline-block h-2 w-2 rounded-full align-middle mr-1" style={{ background: c }} />}
                          {p.f != null ? franchises[p.f].name : "Unassigned"}
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold shrink-0">${p.salary}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        ) : (
          <Empty>No auctions on file in this range (they start in 2010).</Empty>
        )}
      </Panel>

      {/* ------------------------------------------------------------ Table */}
      <Panel title={`Standings, ${rangeLabel}`} note="Click a column to sort. Records are regular season; postseason is week-17 games from 2003 (the week-18 All-Star game isn't counted). All-play and luck need weekly scores (2003+).">
        <StandingsTable rows={d.list} focusColor={focusColor} />
      </Panel>

      {tip && <TipBox tip={tip} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border bg-white p-4 sm:p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="text-xs text-muted-foreground mb-3 mt-0.5">{note}</p>}
      {children}
    </section>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground truncate" title={sub}>{sub}</p>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center rounded border border-dashed border-gray-200 text-sm text-muted-foreground px-4 text-center">{children}</div>
}

function Legend({ items }: { items: Array<{ label: string; color: string; kind: "line" | "box" }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-gray-700">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "line" ? (
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: it.color }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}

type TipPropsFn = (title: string, lines: TipLine[]) => Record<string, unknown>

function HBarList<T extends { id: string }>({
  rows, value, max, color, label, right, tip, tipProps, empty,
}: {
  rows: T[]; value: (r: T) => number; max: number; color: (r: T) => string; label: (r: T) => string; right: (r: T) => string
  tip: (r: T) => { title: string; lines: TipLine[] }; tipProps: TipPropsFn; empty: string
}) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const t = tip(r)
        return (
          <li key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-green-600" {...tipProps(t.title, t.lines)}>
            <span className="truncate">{label(r)}</span>
            <span className="h-3 rounded-r bg-gray-50">
              <span className="block h-3 rounded-r" style={{ width: `${Math.max(value(r) ? 3 : 0, (value(r) / max) * 100)}%`, background: color(r) }} />
            </span>
            <span className="tabular-nums text-xs text-gray-600 w-14 text-right">{right(r)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function DivergingList<T>({
  rows, value, max, label, right, bold, tip, tipProps, compact,
}: {
  rows: T[]; value: (r: T) => number; max: number; label: (r: T) => string; right: (r: T) => string; bold: (r: T) => boolean
  tip: (r: T) => { title: string; lines: TipLine[] }; tipProps: TipPropsFn; compact?: boolean
}) {
  return (
    <ul className={compact ? "space-y-1" : "space-y-1.5"}>
      {rows.map((r, i) => {
        const v = value(r)
        const w = (Math.abs(v) / max) * 50
        const t = tip(r)
        return (
          <li key={i} className={`grid ${compact ? "grid-cols-[minmax(0,1fr)_5rem_2.5rem]" : "grid-cols-[minmax(0,9rem)_1fr_3rem]"} items-center gap-2 text-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-green-600`} {...tipProps(t.title, t.lines)}>
            <span className={`truncate ${bold(r) ? "font-semibold" : ""}`}>{label(r)}</span>
            <span className="relative h-3">
              <span className="absolute left-1/2 top-[-2px] bottom-[-2px] w-px" style={{ background: INK.axis }} />
              <span
                className="absolute top-0 h-3"
                style={{
                  width: `${w}%`,
                  left: v >= 0 ? "50%" : `${50 - w}%`,
                  background: v >= 0 ? DIV.pos : DIV.neg,
                  borderRadius: v >= 0 ? "0 4px 4px 0" : "4px 0 0 4px",
                }}
              />
            </span>
            <span className="tabular-nums text-xs text-gray-600 text-right">{right(r)}</span>
          </li>
        )
      })}
    </ul>
  )
}

type Derived = {
  years: number[]
  champsByYear: Array<{ y: number; champs: Array<{ f: number; name: string; co: boolean }>; ru: { f: number; name: string } | null }>
  h2hTeams: number[]
  h2h: Map<string, { W: number; L: number; T: number }>
}

function TitleStrip({
  d, franchises, focusColor, tipProps,
}: { d: Derived; franchises: DashboardData["franchises"]; focusColor: (id: string) => string | null; tipProps: TipPropsFn }) {
  const rowsSet = new Set<number>()
  for (const c of d.champsByYear) {
    for (const x of c.champs) rowsSet.add(x.f)
    if (c.ru) rowsSet.add(c.ru.f)
  }
  const titleCount = (f: number) => d.champsByYear.reduce((a, c) => a + c.champs.filter((x) => x.f === f).reduce((s, x) => s + (x.co ? 0.5 : 1), 0), 0)
  const rows = [...rowsSet].sort((a, b) => titleCount(b) - titleCount(a) || franchises[a].name.localeCompare(franchises[b].name))
  const cell = 22
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid" style={{ gridTemplateColumns: `minmax(8rem, 11rem) repeat(${d.years.length}, ${cell}px) 3rem` }}>
          <div />
          {d.years.map((y) => (
            <div key={y} className="text-[10px] text-muted-foreground text-center tabular-nums" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 34 }}>
              {y}
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground text-right self-end">Titles</div>
          {rows.map((f) => {
            const c = focusColor(franchises[f].id) ?? INK.primary
            return [
              <Link key={`n${f}`} href={`/history/franchises/${franchises[f].id}`} className="truncate text-sm pr-2 hover:underline" style={{ lineHeight: `${cell}px` }}>
                {franchises[f].name}
              </Link>,
              ...d.years.map((y) => {
                const yc = d.champsByYear.find((x) => x.y === y)!
                const champ = yc.champs.find((x) => x.f === f)
                const ru = yc.ru?.f === f
                const label = champ ? (champ.co ? "Co-champion" : "Champion") : ru ? "Runner-up" : null
                return (
                  <div
                    key={`${f}-${y}`}
                    className="flex items-center justify-center border-l border-gray-50"
                    style={{ height: cell }}
                    {...(label ? tipProps(`${y}: ${champ?.name ?? yc.ru?.name}`, [{ label: "Result", value: label }]) : {})}
                  >
                    {champ && !champ.co && <span className="block h-3 w-3 rounded-full" style={{ background: c }} />}
                    {champ && champ.co && <span className="block h-3 w-3 rounded-full" style={{ background: `linear-gradient(90deg, ${c} 50%, transparent 50%)`, boxShadow: `inset 0 0 0 1.5px ${c}` }} />}
                    {ru && <span className="block h-3 w-3 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${c}` }} />}
                  </div>
                )
              }),
              <div key={`t${f}`} className="text-sm tabular-nums text-right font-medium" style={{ lineHeight: `${cell}px` }}>{fmtTitles(titleCount(f))}</div>,
            ]
          })}
        </div>
      </div>
    </div>
  )
}

function Heatmap({
  d, franchises, focusColor, tipProps,
}: { d: Derived; franchises: DashboardData["franchises"]; focusColor: (id: string) => string | null; tipProps: TipPropsFn }) {
  const teams = d.h2hTeams
  const stepFor = (share: number) => (share >= 0.65 ? 4 : share > 0.53 ? 3 : share >= 0.47 ? 2 : share > 0.35 ? 1 : 0)
  return (
    <div className="overflow-x-auto">
      <table className="border-separate text-xs" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {teams.map((t) => (
              <th key={t} className="font-medium text-[10px] text-gray-600 align-bottom px-0.5" style={{ minWidth: 52 }}>
                <span className="inline-block max-w-[52px] leading-tight">{franchises[t].name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((r) => (
            <tr key={r}>
              <th className="text-left font-medium whitespace-nowrap pr-2 text-sm">
                {focusColor(franchises[r].id) && <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ background: focusColor(franchises[r].id)! }} />}
                {franchises[r].name}
              </th>
              {teams.map((c) => {
                if (r === c) return <td key={c} className="rounded bg-gray-100" />
                const x = d.h2h.get(`${r}|${c}`)
                if (!x) return <td key={c} className="text-center text-gray-300">—</td>
                const g = x.W + x.L + x.T
                const share = (x.W + 0.5 * x.T) / g
                const step = stepFor(share)
                const dark = step === 0 || step === 4
                return (
                  <td
                    key={c}
                    className="rounded text-center tabular-nums px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-gray-900 hover:ring-2 hover:ring-gray-900"
                    style={{ background: DIV_STEPS[step], color: dark ? "#ffffff" : INK.primary }}
                    {...tipProps(`${franchises[r].name} v ${franchises[c].name}`, [
                      { label: "Record", value: rec(x) },
                      { label: "Win share", value: pctStr(share) },
                      { label: "Games", value: String(g) },
                    ])}
                  >
                    {x.W}-{x.L}{x.T ? `-${x.T}` : ""}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
        <span>Row trails</span>
        {DIV_STEPS.map((c) => <span key={c} className="inline-block h-3 w-6 rounded-sm" style={{ background: c }} />)}
        <span>Row leads</span>
      </div>
    </div>
  )
}

type Row = {
  i: number; id: string; name: string; seasons: number; W: number; L: number; T: number; PF: number; G: number
  PA: number; GA: number; titles: number; finals: number; rankSum: number; bestRank: number
  apW: number; apG: number; luck: number; postW: number; postL: number; high: number
}
const COLUMNS: Array<{ key: string; label: string; get: (r: Row) => number; show: (r: Row) => string; hide?: string }> = [
  { key: "seasons", label: "Seasons", get: (r) => r.seasons, show: (r) => String(r.seasons) },
  { key: "pct", label: "Record", get: (r) => pctOf(r), show: (r) => `${rec(r)} (${pctStr(pctOf(r))})` },
  { key: "ppg", label: "PPG", get: (r) => r.PF / Math.max(1, r.G), show: (r) => (r.PF / Math.max(1, r.G)).toFixed(1) },
  { key: "papg", label: "Opp PPG", get: (r) => (r.GA ? r.PA / r.GA : 0), show: (r) => (r.GA ? (r.PA / r.GA).toFixed(1) : "—"), hide: "hidden md:table-cell" },
  { key: "rank", label: "Avg rank", get: (r) => -(r.rankSum / Math.max(1, r.seasons)), show: (r) => (r.rankSum / Math.max(1, r.seasons)).toFixed(1), hide: "hidden md:table-cell" },
  { key: "ap", label: "All-play", get: (r) => (r.apG ? r.apW / r.apG : -1), show: (r) => (r.apG ? pctStr(r.apW / r.apG) : "—"), hide: "hidden lg:table-cell" },
  { key: "luck", label: "Luck", get: (r) => r.luck, show: (r) => (r.apG ? signed(r.luck, 1) : "—"), hide: "hidden lg:table-cell" },
  { key: "post", label: "Postseason", get: (r) => (r.postW + r.postL ? r.postW / (r.postW + r.postL) : -1), show: (r) => (r.postW + r.postL ? `${r.postW}-${r.postL}` : "—"), hide: "hidden sm:table-cell" },
  { key: "high", label: "High game", get: (r) => r.high, show: (r) => (r.high ? String(r.high) : "—"), hide: "hidden lg:table-cell" },
  { key: "finals", label: "Finals", get: (r) => r.finals, show: (r) => String(r.finals), hide: "hidden sm:table-cell" },
  { key: "titles", label: "Titles", get: (r) => r.titles, show: (r) => fmtTitles(r.titles) },
]

function StandingsTable({ rows, focusColor }: { rows: Row[]; focusColor: (id: string) => string | null }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "pct", dir: -1 })
  const col = COLUMNS.find((c) => c.key === sort.key)!
  const sorted = [...rows].sort((a, b) => (col.get(a) - col.get(b)) * sort.dir || a.name.localeCompare(b.name))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-2 font-medium text-muted-foreground">Franchise</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className={`py-2 px-2 font-medium text-right ${c.hide ?? ""}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button
                  onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : -1 }))}
                  className={`hover:text-green-700 ${sort.key === c.key ? "text-gray-900" : "text-muted-foreground"}`}
                >
                  {c.label}
                  {sort.key === c.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const c = focusColor(r.id)
            return (
              <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 pr-2 font-medium whitespace-nowrap">
                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle" style={{ background: c ?? "transparent", boxShadow: c ? "none" : `inset 0 0 0 1.5px ${INK.axis}` }} />
                  <Link href={`/history/franchises/${r.id}`} className="hover:underline">{r.name}</Link>
                </td>
                {COLUMNS.map((cc) => (
                  <td key={cc.key} className={`py-2 px-2 text-right tabular-nums whitespace-nowrap ${cc.hide ?? ""} ${cc.key === sort.key ? "font-semibold" : ""}`}>{cc.show(r)}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------
function TipBox({ tip }: { tip: NonNullable<Tip> }) {
  const left = typeof window !== "undefined" ? Math.min(tip.x + 14, window.innerWidth - 220) : tip.x
  return (
    <div className="pointer-events-none fixed z-50 w-52 rounded-md border bg-white px-3 py-2 text-xs shadow-lg" style={{ left, top: tip.y + 14 }} role="status">
      <p className="text-gray-600 mb-1">{tip.title}</p>
      {tip.lines.map((l) => (
        <div key={l.label} className="flex items-center justify-between gap-3">
          <span className="text-gray-600 inline-flex items-center gap-1.5">
            {l.color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: l.color }} />}
            {l.label}
          </span>
          <span className="font-semibold text-gray-900 tabular-nums">{l.value}</span>
        </div>
      ))}
    </div>
  )
}

type RTip = { active?: boolean; label?: string | number; payload?: Array<{ dataKey?: string | number; value?: unknown; payload?: Record<string, unknown> }> }

function ChartTip({ active, label, payload, names, focus, suffix = "", ordinal: asOrdinal }: RTip & { names: DashboardData["franchises"]; focus: Focus; suffix?: string; ordinal?: boolean }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload ?? {}
  const lines: TipLine[] = []
  if (row.avg !== undefined) lines.push({ label: "League average", value: `${row.avg}${suffix}`, color: INK.primary })
  if (Array.isArray(row.range)) lines.push({ label: "Team range", value: `${row.range[0]}–${row.range[1]}` })
  for (const f of focus) {
    const v = row[f.id]
    lines.push({
      label: names.find((n) => n.id === f.id)!.name,
      value: v == null ? "didn't play" : asOrdinal ? ordinal(Number(v)) : `${v}${suffix}`,
      color: SLOTS[f.slot],
    })
  }
  return <StaticTip title={String(label)} lines={lines} />
}

function HistTip({ active, payload }: RTip) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { bin: string; count: number; share: number }
  return <StaticTip title={`${p.bin} points`} lines={[{ label: "Team scores", value: fmt(p.count) }, { label: "Share", value: `${(p.share * 100).toFixed(1)}%` }]} />
}

function PosTip({ active, label, payload }: RTip) {
  if (!active || !payload?.length) return null
  const lines = [...POS].reverse().map((p) => {
    const v = payload.find((x) => x.dataKey === p)?.value as number | undefined
    return { label: p, value: `${Math.round((v ?? 0) * 100)}%`, color: POS_COLOR[p] }
  })
  return <StaticTip title={`${label} auction`} lines={lines} />
}

function StaticTip({ title, lines }: { title: string; lines: TipLine[] }) {
  return (
    <div className="w-48 rounded-md border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-600 mb-1">{title}</p>
      {lines.map((l) => (
        <div key={l.label} className="flex items-center justify-between gap-3">
          <span className="text-gray-600 inline-flex items-center gap-1.5">
            {l.color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: l.color }} />}
            {l.label}
          </span>
          <span className="font-semibold text-gray-900 tabular-nums">{l.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}
function round(v: number, d = 0) {
  const m = 10 ** d
  return Math.round(v * m) / m
}
function fmt(n: number) {
  return n.toLocaleString("en-US")
}
function pctOf(r: { W: number; L: number; T: number }) {
  return (r.W + 0.5 * r.T) / Math.max(1, r.W + r.L + r.T)
}
function pctStr(v: number) {
  return v >= 1 ? "1.000" : v.toFixed(3).replace(/^0/, "")
}
function rec(r: { W: number; L: number; T: number }) {
  return r.T ? `${r.W}-${r.L}-${r.T}` : `${r.W}-${r.L}`
}
function signed(v: number, d = 0) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`
}
function fmtTitles(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
function normalizeShares(a: DashboardData["auctions"][number]) {
  const total = POS.reduce((s, p) => s + a[p], 0) || 1
  return { year: a.year, ...Object.fromEntries(POS.map((p) => [p, a[p] / total])) }
}

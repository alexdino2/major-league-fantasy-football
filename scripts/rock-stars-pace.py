#!/usr/bin/env python3
"""Rock Stars 2026 vs. the all-time low season (1997 Fruity Whipple Hot Mops).

Scoring has inflated since the early era, so raw totals can't be compared.
Adjustment: take FWHM's points per game as a share of what the other nine teams
averaged that same year (1997), then apply that share to what the other nine
teams are averaging now. That is the 2026 total the Rock Stars must beat.

1997 has no weekly box scores in data/yearly-stats (weekly_results starts in
2003), so the FWHM line is the adjusted ratio times the other teams' actual
cumulative average, week by week.

Usage: python3 scripts/rock-stars-pace.py [--games 16] [--out docs/rock-stars-pace.png]
Needs: matplotlib. Pulls the current season live from the Sleeper API.
"""
import argparse, csv, json, os, urllib.request

LEAGUE_ID = "1389281969950441472"
HIST = os.path.join(os.path.dirname(__file__), "..", "data", "yearly-stats", "historicaldata.csv")
LOW_YEAR, LOW_TEAM = "1997", "Fruity Whipple Hot Mops"
US = "Rockstars"  # Sleeper team name


def get(path):
    with urllib.request.urlopen(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}{path}") as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=16, help="2026 regular-season games")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "docs", "rock-stars-pace.png"))
    a = ap.parse_args()

    # --- historical baseline -------------------------------------------------
    rows = [r for r in csv.DictReader(open(HIST)) if r["Year"] == LOW_YEAR and r["PointsFor"]]
    games = lambda r: int(r["Wins"]) + int(r["Losses"]) + int(r["Ties"])
    low = next(r for r in rows if r["FantasyTeamName"] == LOW_TEAM)
    others = [r for r in rows if r is not low]
    low_ppg = float(low["PointsFor"]) / games(low)
    oth_ppg = sum(float(r["PointsFor"]) for r in others) / sum(games(r) for r in others)
    ratio = low_ppg / oth_ppg

    # --- 2026 from Sleeper ---------------------------------------------------
    users = {u["user_id"]: u for u in get("/users")}
    names = {r["roster_id"]: users[r["owner_id"]]["metadata"].get("team_name", "") for r in get("/rosters")}
    us = next(k for k, v in names.items() if v == US)
    scored = get("")["settings"]["last_scored_leg"]
    mine, oth_avg = [], []
    for w in range(1, scored + 1):
        m = get(f"/matchups/{w}")
        mine.append(next(x["points"] for x in m if x["roster_id"] == us))
        o = [x["points"] for x in m if x["roster_id"] != us]
        oth_avg.append(sum(o) / len(o))
    oth_now = sum(oth_avg) / scored
    cum = lambda xs: [sum(xs[: i + 1]) for i in range(len(xs))]
    mine_cum, oth_cum = cum(mine), cum(oth_avg)

    # --- the number ----------------------------------------------------------
    G = a.games
    floor_total = ratio * oth_now * G
    floor_line = [ratio * oth_now * w for w in range(G + 1)]  # pace line
    floor_line[1: scored + 1] = [ratio * c for c in oth_cum]  # actual through scored weeks
    rs_ppg = mine_cum[-1] / scored
    rs_proj = rs_ppg * G
    need = floor_total - mine_cum[-1]
    left = G - scored

    print(f"{LOW_TEAM} {LOW_YEAR}: {low['PointsFor']} in {games(low)} games = {low_ppg:.1f}/g; other nine {oth_ppg:.1f}/g; ratio {ratio:.4f}")
    print(f"2026 other nine avg: {oth_now:.2f}/g after {scored} wks -> adjusted low {ratio*oth_now:.2f}/g, {floor_total:.0f} over {G}")
    print(f"Rock Stars: {mine_cum[-1]:.1f} ({rs_ppg:.1f}/g), on pace for {rs_proj:.0f}, {rs_ppg/oth_now:.3f} of others (FWHM {ratio:.3f})")
    print(f"To stay above: {need:.1f} more in {left} games = {need/left:.1f}/g ({need/left/oth_now:.3f} of others)")
    print("weekly:", [round(x, 1) for x in mine], "others:", [round(x, 1) for x in oth_avg])

    # --- chart ---------------------------------------------------------------
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    xs = list(range(G + 1))
    fig, ax = plt.subplots(figsize=(10, 6), dpi=150)
    ax.plot(xs, floor_line, color="#B8860B", lw=2.5, label=f"FWHM {LOW_YEAR}, adjusted ({ratio:.1%} of other teams) = {floor_total:.0f}")
    ax.plot(range(scored + 1), [0] + mine_cum, color="#C0392B", lw=3, marker="o", label=f"Rock Stars 2026 actual: {mine_cum[-1]:.0f} thru wk {scored}")
    ax.plot([scored, G], [mine_cum[-1], mine_cum[-1] + rs_ppg * left], color="#C0392B", lw=1.5, ls=":", label=f"Rock Stars current pace: {rs_proj:.0f}")
    ax.plot([scored, G], [mine_cum[-1], floor_total], color="#1F6F43", lw=2, ls="--", label=f"Needed to stay above: {need/left:.1f}/wk from wk {scored+1} on")
    ax.annotate(f"{floor_total:.0f}", (G, floor_total), textcoords="offset points", xytext=(-4, 8), ha="right", color="#B8860B", fontweight="bold")
    ax.annotate(f"{rs_proj:.0f}", (G, mine_cum[-1] + rs_ppg * left), textcoords="offset points", xytext=(-4, -16), ha="right", color="#C0392B", fontweight="bold")
    ax.set_xlim(0, G); ax.set_ylim(0, None)
    ax.set_xlabel("Week"); ax.set_ylabel("Cumulative points")
    ax.set_title("Rock Stars vs. the all-time low (scoring-adjusted)", loc="left", fontweight="bold")
    ax.grid(alpha=0.25); ax.legend(loc="upper left", frameon=False, fontsize=9)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    fig.tight_layout()
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    fig.savefig(a.out)
    print("wrote", a.out)


if __name__ == "__main__":
    main()

# MLFF history: data gaps to fill

Generated alongside `data/history/league.json` by `node scripts/build-history-site.js`, which prints each machine-detected issue as a `WARN` line. The list is ordered by how much each gap matters to the site.

## What we have

| Data | Years on file | Missing |
|---|---|---|
| Season standings (W-L-T, PF, PA) | 1994-2025 (all 32) | 2001 has only the pre-CBS sheet line; 1999 has no points against |
| Week-by-week scores | 2003-2025 | 1994-2002 |
| Playoff bracket export | 2003-2021, 2023, 2025 | 1994-2002, 2022, 2024; partial in 2019 (2 of 5 games) and 2021 (1 of 5) |
| Champion | 1994-2025 (`data/champions.json`) | none |
| Runner-up | 28 of 32 seasons | 1994, 1997, 1999 (no final rank for the runner-up); co-champion year 2022 has none by definition |
| Final placings 1st-10th | 22 seasons (2017 includes a tied 5th-place game) | 1994-1997, 1999, 2000, 2019, 2021, 2022, 2024 (partial) |
| Auction results with prices | 2010-2025 | 1994-2009 (2008 file is a garbled snake-draft export) |
| Player season points in auction files | 2021-2025 | 2010-2020 |

## 1. Missing scores (highest priority)

- **1994-2002 weekly scores.** Single-game records, streaks and head-to-head all start in 2003 because nothing earlier is on file. Old emails, printouts or the pre-CBS host's exports would let us extend the record book back to 1994.
- **2001 season.** CBS has no data for 2001 (no standings, record book, weekly results or bracket). All we have is one line per team in the pre-CBS sheet, which still calls Munich "Italian Stallions". The site uses "Munich Cowboys" for 2001 because CBS uses that name in both 2000 and 2002.
- **2023 week 18.** Only TBA placeholders. The site shows the 2023 final as the week-17 leg only (Egyptian Magicians 41, Generals 38). We need the week-18 score to show the two-week total.
- **2024 week 17.** All five games are TBA placeholders, including the first leg of the final. The site shows Generals over LA Losers from week 18 only (110-69).
- **Playoff brackets for 2022 and 2024**, plus the missing games in 2019 and 2021. Without them we can't place teams below 2nd in those seasons.
- **Pre-2003 postseason.** How the title was decided in 1994-2002, and the scores, aren't in any file.

## 2. Records that disagree

- **2022 co-championship.** The CBS export has Munich Cowboys beating Generals 123-83 over weeks 17-18 (60-30, 63-53). The league record (`champions.json`) lists Generals and Munich as co-champions. The site shows the league record and a note. A sentence on why the title was shared would close this out.
- **`data/standings.json` double-counts 2000 and 2002.** `scripts/merge-pre-cbs-standings.js` adds the whole pre-CBS sheet (1994-2002) to CBS all-time totals, but CBS already includes 2000 and 2002. Example: Leeds United shows 324 wins there. 21 of those come from 2000 and 2002 being counted twice. The new history pages don't use this file. Fix the merge to stop at 1999 (plus 2001) if anything else is going to use it.
- **CBS standings include the week-17 game in some years.** For 2003-2009 and 2021-2022, CBS standings have 17 games per team. The site rebuilds every 2003+ regular-season record from weeks 1-16 so the years are comparable, which means some records differ by one game from CBS.
- **2025 CBS record book** lists "Least Points Scored, Game: Munich Cowboys, 0". That's the week-18 TBA placeholder, not a real game, and the site ignores it.

## 3. Franchise lineage to confirm

The site keeps a franchise's history through renames only where the league's own title list already does (`scripts/lib/franchises.js`):

- Italian Stallions → Munich Cowboys
- Average Joe's (2013) → Polish Power
- Magical Mystery Men, ಠ_ಠ (2013), Homer's Zeroes (feat. Homer), I hate you guys (feat. Homer), My hate for you, it grow → Homers Heroes

Still unconfirmed, so each is its own franchise for now:

- **1998 and 1999.** Magical Mystery Men is missing both years. Osama Bin Laden (1998) and Latin Assassins (1999) appear in their place. Same owner?
- **P-Funk All Stars (1998-2005)** vs. **Donora Dragons**, who return in 2006 after playing 1994-1996. Is that a continuation, and are both Donora runs the same owner?
- **Kentucky Football Club (2014)** and **Relegators (2024)**: new owners, or taking over an existing franchise?
- Managers for Death Dealers, Muff Marauders, Rat Boys, Fruity Whipple Hot Mops, Osama Bin Laden, Latin Assassins, and P-Funk All Stars. Earlier Homers Heroes and Donora Dragons managers ("+2" in CBS) are also unnamed.

## 4. Auction / draft files

- **2020:** `scripts/fix-munich-cowboys.js` labeled the first 16 rows "Munich Cowboys", but that year has its own MUNICH COWBOYS block. The unlabeled block is Masters of Disaster's. The site build assigns it correctly. The raw CSV is still wrong if anything else reads it.
- **2013:** Average Joe's (Polish Power) has no picks in the file, and the first, unlabeled block can't be matched to a team for certain (16 picks show as "Unassigned").
- **2010-2011:** columns are shifted one place (handled), and kickers and defenses carry no position label.
- **2008:** the export is unreadable (rounds and teams are mixed up). **1994-2007 and 2009:** no draft files at all.
- **Player points before 2021:** the scraper only pulled `Total FPTS` for 2021-2025, so best-value and bust lists exist only for those years.

## 5. Editorial calls for the commissioner

- **"Osama Bin Laden" (1998)** is shown as recorded. Change it if you'd rather not have that name on the public site.
- **The Teams page publishes managers' personal emails and phone numbers.** That was already there and this change doesn't touch it, but it's worth a look.
- **Removed from the old History page** because the data contradicts them: "League founded with 12 teams" (1994 had 8; the league went to 10 in 1995) and a "third starting receiver added in 2010" milestone that nothing on file supports. The sample "Longest losing streak: Generals, 10 games, 2003" is 9 games in the actual 2003 results.

## How to update

1. Drop new or corrected CSVs into `data/yearly-stats/` (same formats as the existing files), or fix `data/champions.json`.
2. Add any confirmed rename to `aliases` in `scripts/lib/franchises.js`.
3. Run `pnpm build-history-site`, check the `WARN` lines, and commit `data/history/league.json`.

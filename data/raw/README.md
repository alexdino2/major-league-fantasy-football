# data/raw

Drop saved CBS pages here. `scripts/parse-draft-results-html.js` reads them and
writes the matching CSV into `data/yearly-stats/`, so the draft results can be
refreshed without a working browser session or stored credentials.

## Back-filling draft results

1. Open the draft results page in a browser where you are already signed in to
   CBS:

   | Year | URL |
   |---|---|
   | 2024 | `https://mlffatl.football.cbssports.com/draft/results/2024:Pre-season:MLFF%20AUCTION3/` |
   | 2025 | `https://mlffatl.football.cbssports.com/draft/results/2025:Pre-season:Pre-season/` |

2. Save each one into this folder, named `draft_<year>.html`:

   - `data/raw/draft_2024.html`
   - `data/raw/draft_2025.html`

   **File → Save Page As… → "Web Page, HTML Only"** is enough. The parser only
   reads the results table, so the CSS, images and scripts are not needed. If
   your browser only offers "Complete", that works too — the extra
   `draft_2024_files/` folder it creates alongside can be deleted.

3. Parse them:

   ```bash
   pnpm parse-draft-results-html          # every draft_<year>.html found here
   pnpm parse-draft-results-html 2024     # or just one year
   ```

4. Re-run the analysis:

   ```bash
   pnpm auction-analysis
   ```

## Checking it worked

The parser prints the header row it found and how many rows carried points:

```
  2024: header row -> pos | player | salary | elig | total fpts | active fpts
  2024: wrote 160 rows across 10 teams; 160 have Total FPTS
```

`160 rows across 10 teams` is the expected shape — 10 teams, 16 roster spots.

If it reports **0 have Total FPTS**, the saved page was the pre-season view of
the draft results, which lists salaries but no points. That is exactly how the
2025 file ended up empty the first time. Open the page again and confirm the
`Total FPTS` / `Active FPTS` columns actually have numbers in them before
saving.

If it cannot find the table at all, CBS changed the page layout — the parser
locates it by looking for a header row containing both `Player` and `Salary`
rather than by a fixed CSS path, so this should be rare.

## A note on committing these

The saved HTML is only an input to the CSVs, and the CSVs are what the analysis
reads. Committing the HTML is fine if it is useful to keep the source around,
but it is safe to delete once `data/yearly-stats/draft_results_<year>.csv` has
the points in it.

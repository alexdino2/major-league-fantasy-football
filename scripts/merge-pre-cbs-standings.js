const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const DATA_DIR = path.join(process.cwd(), 'data')
const EXCEL_PATH = path.join(DATA_DIR, 'MLFF Records Pre-CBS.xlsx')

/** Renamed franchises: pre-CBS name -> current CBS franchise name */
const TEAM_MAPPINGS = {
  'Magical Mystery Men': 'Homers Heroes',
  'Italian Stallions': 'Munich Cowboys',
}

function aggregatePreCbs(rows) {
  const stats = {}

  for (const row of rows) {
    const rawTeam = row.FantasyTeamName
    if (!rawTeam) continue

    const team = TEAM_MAPPINGS[rawTeam] || rawTeam
    if (!stats[team]) {
      stats[team] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }
    }

    for (const [field, col] of [
      ['wins', 'Wins'],
      ['losses', 'Losses'],
      ['ties', 'Ties'],
      ['pointsFor', 'PointsFor'],
      ['pointsAgainst', 'PointsAgainst'],
    ]) {
      const value = row[col]
      if (value !== undefined && value !== null && value !== '') {
        stats[team][field] += Number(value)
      }
    }
  }

  return stats
}

function mergeStandings(cbsStandings, preCbs) {
  const merged = cbsStandings.map((standing) => {
    const pre = preCbs[standing.team] || {}
    const wins = standing.wins + (pre.wins || 0)
    const losses = standing.losses + (pre.losses || 0)
    const ties = standing.ties + (pre.ties || 0)
    const pointsFor = standing.pointsFor + (pre.pointsFor || 0)
    const pointsAgainst = standing.pointsAgainst + (pre.pointsAgainst || 0)
    const games = wins + losses + ties

    return {
      ...standing,
      wins,
      losses,
      ties,
      winPercentage: games ? Math.round((wins / games) * 1000) / 1000 : 0,
      pointsFor,
      pointsAgainst,
    }
  })

  merged.sort((a, b) => b.winPercentage - a.winPercentage || b.wins - a.wins)
  return merged
}

function loadPreCbsRows() {
  const workbook = XLSX.readFile(EXCEL_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
}

function mergePreCbsStandings(cbsStandings) {
  const rows = loadPreCbsRows()
  const preCbs = aggregatePreCbs(rows)
  return mergeStandings(cbsStandings, preCbs)
}

function writeMergedStandings(merged, cbsStandings) {
  fs.writeFileSync(
    path.join(DATA_DIR, 'standings-cbs.json'),
    JSON.stringify(cbsStandings, null, 2) + '\n'
  )

  fs.writeFileSync(
    path.join(DATA_DIR, 'standings.json'),
    JSON.stringify(merged, null, 2) + '\n'
  )

  const historyPath = path.join(DATA_DIR, 'history.json')
  if (fs.existsSync(historyPath)) {
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    history.standings = merged
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n')
  }
}

function loadCbsStandings() {
  const cbsOnlyPath = path.join(DATA_DIR, 'standings-cbs.json')
  if (fs.existsSync(cbsOnlyPath)) {
    return JSON.parse(fs.readFileSync(cbsOnlyPath, 'utf-8'))
  }

  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'standings.json'), 'utf-8'))
}

function main() {
  const cbsStandings = loadCbsStandings()
  const merged = mergePreCbsStandings(cbsStandings)
  writeMergedStandings(merged, cbsStandings)

  const rows = loadPreCbsRows()
  const years = rows.map((r) => r.Year).filter(Boolean)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  console.log('Merged pre-CBS standings into standings.json and history.json')
  console.log(`Pre-CBS seasons: ${minYear}-${maxYear} (${rows.length} team-seasons)`)
}

if (require.main === module) {
  main()
}

module.exports = { mergePreCbsStandings, writeMergedStandings, loadCbsStandings }

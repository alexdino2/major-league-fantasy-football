const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

interface Championship {
  team: string
  championships: number
  years: string[]
}

interface Standing {
  team: string
  wins: number
  losses: number
  ties: number
  winPercentage: number
  pointsFor: number
  pointsAgainst: number
  managers: string
}

interface Champion {
  year: number
  teams: string[]
}

interface LeagueRecord {
  category: string
  holder: string
  value: string
  year: number
}

interface Milestone {
  year: number
  description: string
}

interface Consistent {
  rank: number
  team: string
  seasons: number
  playoffAppearances: number
  playoffPercentage: number
}

interface MostConsistent {
  team: string
  avgFinish: number
  avgPointsPerYear: number
}

interface HistoryData {
  championships: Championship[]
  standings: Standing[]
  champions: Champion[]
  records: LeagueRecord[]
  milestones: Milestone[]
  mostConsistent: MostConsistent[]
}

function parseNumber(str: string): number {
  return parseFloat(str.replace(/,/g, ''))
}

function parsePercentage(str: string): number {
  return parseFloat(str.replace('%', '')) / 100
}

function findTableByHeaderText(document: Document, headerText: string): Element | null {
  const tables = document.querySelectorAll('table')
  for (const table of tables) {
    const headers = table.querySelectorAll('th')
    for (const header of headers) {
      if (header.textContent?.includes(headerText)) {
        return table
      }
    }
  }
  return null
}

function parseChampionshipsTable(document: Document): Championship[] {
  const results: Championship[] = []
  const cardTitles = Array.from(document.querySelectorAll('div.cardTitle'))
  const champTitle = cardTitles.find(div => div.textContent?.trim().toUpperCase() === 'MOST CHAMPIONSHIPS')
  if (!champTitle) return results
  let table = champTitle.parentElement?.parentElement?.parentElement?.querySelector('table')
  if (!table) return results
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    const cells = row.querySelectorAll('td')
    if (cells.length >= 3) {
      const team = cells[0].textContent?.trim() || ''
      const championships = parseInt(cells[1].textContent || '0')
      // Years are links separated by commas
      const years: string[] = Array.from(cells[2].querySelectorAll('a')).map(a => a.textContent?.trim() || '')
      results.push({ team, championships, years })
    }
  })
  return results
}

function parseStandingsTable(document: Document): Standing[] {
  const results: Standing[] = []
  const cardTitles = Array.from(document.querySelectorAll('div.cardTitle'))
  const standingsTitle = cardTitles.find(div => div.textContent?.trim().toUpperCase() === 'ALL-TIME STANDINGS')
  if (!standingsTitle) return results
  let table = standingsTitle.parentElement?.parentElement?.parentElement?.querySelector('table')
  if (!table) return results
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    const cells = row.querySelectorAll('td')
    if (cells.length >= 8) {
      const team = cells[0].textContent?.trim() || ''
      const wins = parseInt(cells[1].textContent || '0')
      const losses = parseInt(cells[2].textContent || '0')
      const ties = parseInt(cells[3].textContent || '0')
      const winPercentage = parseFloat(cells[4].textContent || '0')
      const pointsFor = parseNumber(cells[5].textContent || '0')
      const pointsAgainst = parseNumber(cells[6].textContent || '0')
      const managers = cells[7].textContent?.trim() || ''
      results.push({ team, wins, losses, ties, winPercentage, pointsFor, pointsAgainst, managers })
    }
  })
  return results
}

function parseChampionsTable(document: Document): Champion[] {
  const results: Champion[] = []
  const cardTitles = Array.from(document.querySelectorAll('div.cardTitle'))
  const championsTitle = cardTitles.find(div => div.textContent?.trim().toUpperCase() === 'LEAGUE CHAMPIONS')
  if (!championsTitle) return results
  let table = championsTitle.parentElement?.parentElement?.parentElement?.querySelector('table')
  if (!table) return results
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    const cells = row.querySelectorAll('td')
    if (cells.length >= 2) {
      // Year is a link
      const yearText = cells[0].querySelector('a')?.textContent?.trim() || ''
      const year = parseInt(yearText)
      // There may be multiple champion teams in a single cell
      const teams: string[] = Array.from(cells[1].querySelectorAll('.championTeamName')).map(div => div.textContent?.trim() || '')
      // If no .championTeamName, fallback to text
      if (teams.length === 0) {
        const fallback = cells[1].textContent?.trim() || ''
        if (fallback && fallback.toUpperCase() !== 'SET CHAMPION') teams.push(fallback)
      }
      if (!isNaN(year) && teams.length > 0) {
        results.push({ year, teams })
      }
    }
  })
  return results
}

function parseMostConsistentTable(document: Document): MostConsistent[] {
  const results: MostConsistent[] = []
  const cardTitles = Array.from(document.querySelectorAll('div.cardTitle'))
  const consistentTitle = cardTitles.find(div => div.textContent?.trim().toUpperCase() === 'MOST CONSISTENT')
  if (!consistentTitle) return results
  let table = consistentTitle.parentElement?.parentElement?.parentElement?.querySelector('table')
  if (!table) return results
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    const cells = row.querySelectorAll('td')
    if (cells.length >= 3) {
      const team = cells[0].textContent?.trim() || ''
      const avgFinish = parseFloat(cells[1].textContent || '0')
      const avgPointsPerYear = parseFloat(cells[2].textContent || '0')
      results.push({ team, avgFinish, avgPointsPerYear })
    }
  })
  return results
}

function parseHistoryData(html: string): HistoryData {
  const dom = new JSDOM(html)
  const document = dom.window.document

  // Parse Championships table
  const championships: Championship[] = parseChampionshipsTable(document)

  // Parse All-time Standings table
  const standings: Standing[] = parseStandingsTable(document)

  // Parse League Champions table
  const champions: Champion[] = parseChampionsTable(document)

  // Parse Records table
  const records: LeagueRecord[] = []
  const recordsTable = findTableByHeaderText(document, 'League Records')
  if (recordsTable) {
    const rows = recordsTable.querySelectorAll('tbody tr')
    rows.forEach((row: Element) => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 4) {
        records.push({
          category: cells[0].textContent?.trim() || '',
          holder: cells[1].textContent?.trim() || '',
          value: cells[2].textContent?.trim() || '',
          year: parseInt(cells[3].textContent || '0')
        })
      }
    })
  }

  // Parse Milestones table
  const milestones: Milestone[] = []
  const milestonesTable = findTableByHeaderText(document, 'League Milestones')
  if (milestonesTable) {
    const rows = milestonesTable.querySelectorAll('tbody tr')
    rows.forEach((row: Element) => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 2) {
        milestones.push({
          year: parseInt(cells[0].textContent || '0'),
          description: cells[1].textContent?.trim() || ''
        })
      }
    })
  }

  // Parse Most Consistent table
  const mostConsistent: MostConsistent[] = parseMostConsistentTable(document)

  return {
    championships,
    standings,
    champions,
    records,
    milestones,
    mostConsistent
  }
}

async function main() {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const htmlPath = path.join(dataDir, 'history-raw.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const historyData = parseHistoryData(html)

    // Write individual files
    fs.writeFileSync(
      path.join(dataDir, 'championships.json'),
      JSON.stringify(historyData.championships, null, 2)
    )

    fs.writeFileSync(
      path.join(dataDir, 'standings.json'),
      JSON.stringify(historyData.standings, null, 2)
    )

    fs.writeFileSync(
      path.join(dataDir, 'champions.json'),
      JSON.stringify(historyData.champions, null, 2)
    )

    fs.writeFileSync(
      path.join(dataDir, 'records.json'),
      JSON.stringify(historyData.records, null, 2)
    )

    fs.writeFileSync(
      path.join(dataDir, 'milestones.json'),
      JSON.stringify(historyData.milestones, null, 2)
    )

    fs.writeFileSync(
      path.join(dataDir, 'most-consistent.json'),
      JSON.stringify(historyData.mostConsistent, null, 2)
    )

    // Write combined history.json
    fs.writeFileSync(
      path.join(dataDir, 'history.json'),
      JSON.stringify(historyData, null, 2)
    )

    console.log('Successfully generated all history data files!')
  } catch (error) {
    console.error('Error generating history data:', error)
    process.exit(1)
  }
}

main() 
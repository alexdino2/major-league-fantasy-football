/**
 * MLFF franchise registry.
 *
 * Every team name that appears in the data files maps to one franchise here.
 * A franchise keeps its history through renames (e.g. Italian Stallions ->
 * Munich Cowboys). Aliases are only listed where the league's own records
 * already treat the names as one franchise (champions.json / championships.json
 * credit the title to the current name). Anything we could not confirm is left
 * as its own franchise and listed in docs/history-data-gaps.md.
 */

const FRANCHISES = [
  { id: 'leeds-united', name: 'Leeds United', manager: 'Josh Kowall', logo: '/logos/leeds.gif', aliases: [] },
  { id: 'masters-of-disaster', name: 'Masters of Disaster', manager: 'Alex Destino', logo: '/logos/masters.png', aliases: [] },
  { id: 'rock-stars', name: 'Rock Stars', manager: 'Mike Grady', logo: '/logos/rockstars.jpg', aliases: [] },
  { id: 'generals', name: 'Generals', manager: 'Cody Patton', logo: '/logos/generals.jpg', aliases: [] },
  { id: 'egyptian-magicians', name: 'Egyptian Magicians', manager: 'Seth Lively', logo: '/logos/egyptian.png', aliases: [] },
  { id: 'la-losers', name: 'LA Losers', manager: 'Eric Harvill', logo: '/logos/losers.jpg', aliases: [] },
  {
    id: 'munich-cowboys',
    name: 'Munich Cowboys',
    manager: 'Brad Venuti',
    logo: '/logos/munich.png',
    // CBS lists the franchise as Munich Cowboys from 2000; the pre-CBS sheet calls it Italian Stallions through 2002.
    aliases: ['Italian Stallions'],
  },
  {
    id: 'homers-heroes',
    name: 'Homers Heroes',
    manager: 'Michael',
    logo: '/logos/homers.jpg',
    // championships.json credits the 1997 (Magical Mystery Men) and 2016 (I hate you guys) titles to Homers Heroes.
    aliases: [
      'Magical Mystery Men',
      "Homer's Zeroes (feat. Homer)",
      'I hate you guys (feat. Homer)',
      'My hate for you, it grow',
      'My hate for you',
    ],
  },
  { id: 'kentucky-football-club', name: 'Kentucky Football Club', manager: 'Gustave Carruth', logo: '/logos/KFC.jpg', aliases: [] },
  { id: 'relegators', name: 'Relegators', manager: 'Patrick Williams', logo: '/logos/relegators.jpg', aliases: [] },
  { id: 'donora-dragons', name: 'Donora Dragons', manager: 'Sammy Kowall', logo: null, aliases: [] },
  { id: 'polish-power', name: 'Polish Power', manager: 'Jeremy Kowall', logo: null, aliases: [] },
  { id: 'p-funk-all-stars', name: 'P-Funk All Stars', manager: null, logo: null, aliases: [] },
  { id: 'death-dealers', name: 'Death Dealers', manager: null, logo: null, aliases: [] },
  { id: 'muff-marauders', name: 'Muff Marauders', manager: null, logo: null, aliases: [] },
  { id: 'rat-boys', name: 'Rat Boys', manager: null, logo: null, aliases: [] },
  { id: 'fruity-whipple-hot-mops', name: 'Fruity Whipple Hot Mops', manager: null, logo: null, aliases: [] },
  { id: 'osama-bin-laden', name: 'Osama Bin Laden', manager: null, logo: null, aliases: [] },
  { id: 'latin-assassins', name: 'Latin Assassins', manager: null, logo: null, aliases: [] },
  { id: 'average-joes', name: "Average Joe's", manager: null, logo: null, aliases: [] },
  { id: 'look-of-disapproval', name: 'ಠ_ಠ', manager: null, logo: null, aliases: [] },
]

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

const BY_NAME = new Map()
for (const f of FRANCHISES) {
  BY_NAME.set(norm(f.name), f)
  for (const a of f.aliases) BY_NAME.set(norm(a), f)
}

/** Returns the franchise for a team name as it appears in any data file, or null. */
function franchiseFor(teamName) {
  return BY_NAME.get(norm(teamName)) || null
}

module.exports = { FRANCHISES, franchiseFor, norm }

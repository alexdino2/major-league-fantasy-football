const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const yearlyStatsDir = path.join(dataDir, 'yearly-stats');

// Function to parse CSV content
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
  return rows;
}

// Function to clean player names (remove team info)
function cleanPlayerName(playerName) {
  // Remove " • TEAM" part from player names
  return playerName.replace(/\s*•\s*[A-Z]{2,3}$/, '').trim();
}

async function mergeDraftResults() {
  const years = [2021, 2022, 2023, 2024];
  const allDrafts = [];
  
  // Read and parse each year's draft results
  for (const year of years) {
    const filePath = path.join(yearlyStatsDir, `draft_results_${year}.csv`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`Warning: ${filePath} not found, skipping...`);
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const rows = parseCSV(content);
      
      // Add year information to each row
      rows.forEach(row => {
        if (row.Team && row.Player) {
          allDrafts.push({
            Team: row.Team.trim(),
            Player: cleanPlayerName(row.Player),
            Year: year
          });
        }
      });
      
      console.log(`Processed ${rows.length} records from ${year}`);
    } catch (error) {
      console.error(`Error processing ${year}:`, error);
    }
  }
  
  // Calculate draft frequency for each team-player combination
  const frequencyMap = new Map();
  
  allDrafts.forEach(draft => {
    const key = `${draft.Team}|${draft.Player}`;
    if (!frequencyMap.has(key)) {
      frequencyMap.set(key, {
        Team: draft.Team,
        Player: draft.Player,
        Draft_freq: 0,
        Years: []
      });
    }
    
    const entry = frequencyMap.get(key);
    entry.Draft_freq++;
    if (!entry.Years.includes(draft.Year)) {
      entry.Years.push(draft.Year);
    }
  });
  
  // Convert to array and sort by frequency (descending)
  const frequencyData = Array.from(frequencyMap.values())
    .sort((a, b) => b.Draft_freq - a.Draft_freq);
  
  // Create CSV content
  const csvHeader = 'Team,Player,Draft_freq';
  const csvRows = frequencyData.map(row => 
    `"${row.Team.replace(/"/g, '""')}","${row.Player.replace(/"/g, '""')}",${row.Draft_freq}`
  );
  
  const csv = [csvHeader, ...csvRows].join('\n');
  
  // Write to file
  const outputPath = path.join(yearlyStatsDir, 'merged_draft_results_2021_2022_2023_2024.csv');
  fs.writeFileSync(outputPath, csv);
  
  console.log(`\nMerged draft results saved to: ${outputPath}`);
  console.log(`Total unique team-player combinations: ${frequencyData.length}`);
  console.log(`Total draft records processed: ${allDrafts.length}`);
  
  // Show top 10 most frequently drafted players
  console.log('\nTop 10 most frequently drafted players:');
  frequencyData.slice(0, 10).forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.Team} - ${entry.Player} (${entry.Draft_freq} times)`);
  });
}

// Run the merge
(async function main() {
  try {
    await mergeDraftResults();
  } catch (error) {
    console.error('Failed to merge draft results:', error);
    process.exit(1);
  }
})(); 
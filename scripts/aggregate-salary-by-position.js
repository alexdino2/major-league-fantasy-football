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

// Function to convert salary string to number
function parseSalary(salaryStr) {
  if (!salaryStr || salaryStr.trim() === '') return 0;
  const salary = parseInt(salaryStr.trim());
  return isNaN(salary) ? 0 : salary;
}

async function aggregateSalaryByPosition() {
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
        if (row.Team && row.ELIG && row.Salary) {
          allDrafts.push({
            Team: row.Team.trim(),
            ELIG: row.ELIG.trim(),
            Salary: parseSalary(row.Salary),
            Year: year
          });
        }
      });
      
      console.log(`Processed ${rows.length} records from ${year}`);
    } catch (error) {
      console.error(`Error processing ${year}:`, error);
    }
  }
  
  // Aggregate salary by team and position (ELIG)
  const salaryMap = new Map();
  
  allDrafts.forEach(draft => {
    const key = `${draft.Team}|${draft.ELIG}`;
    if (!salaryMap.has(key)) {
      salaryMap.set(key, {
        Team: draft.Team,
        ELIG: draft.ELIG,
        Total_Salary: 0,
        Player_Count: 0,
        Years: new Set()
      });
    }
    
    const entry = salaryMap.get(key);
    entry.Total_Salary += draft.Salary;
    entry.Player_Count++;
    entry.Years.add(draft.Year);
  });
  
  // Convert to array and sort by team, then by total salary (descending)
  const salaryData = Array.from(salaryMap.values())
    .sort((a, b) => {
      // First sort by team name
      if (a.Team !== b.Team) {
        return a.Team.localeCompare(b.Team);
      }
      // Then sort by total salary (descending)
      return b.Total_Salary - a.Total_Salary;
    });
  
  // Create CSV content
  const csvHeader = 'Team,ELIG,Total Salary,Years';
  const csvRows = salaryData.map(row => 
    `"${row.Team.replace(/"/g, '""')}","${row.ELIG.replace(/"/g, '""')}",${row.Total_Salary},${row.Years.size}`
  );
  
  const csv = [csvHeader, ...csvRows].join('\n');
  
  // Write to file
  const outputPath = path.join(yearlyStatsDir, 'aggregated_salary_by_position_2021_2024.csv');
  fs.writeFileSync(outputPath, csv);
  
  console.log(`\nAggregated salary data saved to: ${outputPath}`);
  console.log(`Total unique team-position combinations: ${salaryData.length}`);
  console.log(`Total draft records processed: ${allDrafts.length}`);
  
  // Show summary statistics
  const totalSalary = salaryData.reduce((sum, row) => sum + row.Total_Salary, 0);
  console.log(`Total salary across all teams and positions: $${totalSalary.toLocaleString()}`);
  
  // Show top 10 highest spending team-position combinations
  console.log('\nTop 10 highest spending team-position combinations:');
  const topSpenders = Array.from(salaryMap.values())
    .sort((a, b) => b.Total_Salary - a.Total_Salary)
    .slice(0, 10);
  
  topSpenders.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.Team} - ${entry.ELIG}: $${entry.Total_Salary.toLocaleString()} (${entry.Player_Count} players)`);
  });
  
  // Show breakdown by position
  console.log('\nTotal spending by position:');
  const positionTotals = new Map();
  salaryData.forEach(row => {
    if (!positionTotals.has(row.ELIG)) {
      positionTotals.set(row.ELIG, 0);
    }
    positionTotals.set(row.ELIG, positionTotals.get(row.ELIG) + row.Total_Salary);
  });
  
  Array.from(positionTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([position, total]) => {
      console.log(`${position}: $${total.toLocaleString()}`);
    });
}

// Run the aggregation
(async function main() {
  try {
    await aggregateSalaryByPosition();
  } catch (error) {
    console.error('Failed to aggregate salary data:', error);
    process.exit(1);
  }
})(); 
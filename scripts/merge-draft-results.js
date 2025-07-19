const fs = require('fs');
const path = require('path');

const yearlyStatsDir = path.join(process.cwd(), 'data', 'yearly-stats');
const years = [2021, 2022, 2023];
const outputFile = path.join(yearlyStatsDir, 'merged_draft_results_2021_2022_2023.csv');

let mergedRows = [];
let header = null;

years.forEach(year => {
  const file = path.join(yearlyStatsDir, `draft_results_${year}.csv`);
  if (!fs.existsSync(file)) {
    console.warn(`File not found: ${file}`);
    return;
  }
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean);
  if (!header) {
    header = lines[0] + ',Year';
    mergedRows.push(header);
  }
  lines.slice(1).forEach(row => {
    mergedRows.push(row + `,${year}`);
  });
});

fs.writeFileSync(outputFile, mergedRows.join('\n'));
console.log(`Merged file written to ${outputFile}`); 
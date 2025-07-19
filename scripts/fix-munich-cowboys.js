const fs = require('fs');
const path = require('path');

const yearlyStatsDir = path.join(process.cwd(), 'data', 'yearly-stats');

function fixMunichCowboys() {
  const files = fs.readdirSync(yearlyStatsDir).filter(f => /^draft_results_\d{4}\.csv$/.test(f));
  files.forEach(file => {
    const filePath = path.join(yearlyStatsDir, file);
    const backupPath = filePath + '.bak';
    // Backup the original file
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    if (lines.length < 2) return; // skip empty files
    const header = lines[0];
    const rows = lines.slice(1);
    let changed = false;
    for (let i = 0; i < Math.min(16, rows.length); i++) {
      const cols = rows[i].split(',');
      // Only update if Team is empty ("")
      if (cols[0].replace(/"/g, '').trim() === '') {
        cols[0] = '"Munich Cowboys"';
        rows[i] = cols.join(',');
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, [header, ...rows].join('\n'));
      console.log(`Updated first 16 rows of ${file}`);
    } else {
      console.log(`No changes needed for ${file}`);
    }
  });
}

function revertMunichCowboys() {
  const files = fs.readdirSync(yearlyStatsDir).filter(f => /^draft_results_\d{4}\.csv$/.test(f));
  files.forEach(file => {
    const filePath = path.join(yearlyStatsDir, file);
    const backupPath = filePath + '.bak';
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      console.log(`Reverted ${file} from backup.`);
    }
  });
}

if (process.argv[2] === 'revert') {
  revertMunichCowboys();
} else {
  fixMunichCowboys();
} 
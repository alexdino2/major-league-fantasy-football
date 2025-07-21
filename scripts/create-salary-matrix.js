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

// Function to calculate standard deviation
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

// Function to get yearly salary data for a team and position
function getYearlySalaries(team, position, allDrafts) {
  return allDrafts
    .filter(draft => draft.Team === team && draft.ELIG === position)
    .map(draft => draft.Salary);
}

async function createSalaryMatrix() {
  // Read the aggregated salary file
  const aggregatedFilePath = path.join(yearlyStatsDir, 'aggregated_salary_by_position_2021_2024.csv');
  
  if (!fs.existsSync(aggregatedFilePath)) {
    console.error('Aggregated salary file not found. Please run the aggregate-salary-by-position.js script first.');
    return;
  }
  
  try {
    const content = fs.readFileSync(aggregatedFilePath, 'utf8');
    const aggregatedData = parseCSV(content);
    
    console.log(`Processed ${aggregatedData.length} aggregated records`);
    
    // Convert aggregated data to matrix format
    const teams = [...new Set(aggregatedData.map(row => row.Team))].sort();
    const positions = [...new Set(aggregatedData.map(row => row.ELIG))].sort();
    
    console.log(`\nFound ${teams.length} teams and ${positions.length} positions`);
    console.log('Teams:', teams.join(', '));
    console.log('Positions:', positions.join(', '));
    
    // Create matrix data
    const matrixData = [];
    
    teams.forEach(team => {
      const row = { Team: team };
      
      positions.forEach(position => {
        const teamPositionData = aggregatedData.find(row => row.Team === team && row.ELIG === position);
        
        if (teamPositionData) {
          const totalSalary = parseInt(teamPositionData['Total Salary']) || 0;
          const years = parseInt(teamPositionData.Years) || 0;
          const avgSalary = years > 0 ? totalSalary / years : 0;
          
          // For standard deviation, we'll use a placeholder since we don't have yearly breakdown
          // We could estimate it based on typical variance patterns, but for now we'll set to 0
          const stdDev = 0; // Placeholder - would need yearly data for actual calculation
          
          row[`${position}_Avg`] = Math.round(avgSalary * 100) / 100;
          row[`${position}_StdDev`] = stdDev;
          row[`${position}_Years`] = years;
        } else {
          row[`${position}_Avg`] = 0;
          row[`${position}_StdDev`] = 0;
          row[`${position}_Years`] = 0;
        }
      });
      
      matrixData.push(row);
    });
    
    // Create CSV content
    const headers = ['Team'];
    positions.forEach(position => {
      headers.push(`${position}_Avg`, `${position}_StdDev`, `${position}_Years`);
    });
    
    const csvHeader = headers.join(',');
    const csvRows = matrixData.map(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      return values.join(',');
    });
    
    const csv = [csvHeader, ...csvRows].join('\n');
    
    // Write to file
    const outputPath = path.join(yearlyStatsDir, 'salary_matrix_2021_2024.csv');
    fs.writeFileSync(outputPath, csv);
    
    console.log(`\nSalary matrix saved to: ${outputPath}`);
    console.log(`Matrix dimensions: ${teams.length} teams × ${positions.length} positions`);
    
    // Show summary statistics
    console.log('\nSummary by position (average across all teams):');
    positions.forEach(position => {
      const avgSalaries = matrixData
        .map(row => row[`${position}_Avg`])
        .filter(avg => avg > 0);
      
      if (avgSalaries.length > 0) {
        const overallAvg = avgSalaries.reduce((sum, avg) => sum + avg, 0) / avgSalaries.length;
        console.log(`${position}: $${overallAvg.toFixed(2)} average salary`);
      }
    });
    
    // Show teams with highest average spending by position
    console.log('\nTop 3 teams by average salary per position:');
    positions.forEach(position => {
      const positionData = matrixData
        .map(row => ({ team: row.Team, avg: row[`${position}_Avg`] }))
        .filter(item => item.avg > 0)
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3);
      
      if (positionData.length > 0) {
        console.log(`${position}:`);
        positionData.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.team}: $${item.avg.toFixed(2)}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error reading aggregated salary file:', error);
    return;
  }
}

// Run the matrix creation
(async function main() {
  try {
    await createSalaryMatrix();
  } catch (error) {
    console.error('Failed to create salary matrix:', error);
    process.exit(1);
  }
})(); 
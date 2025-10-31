#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const conflictPatterns = {
  border: /border\s*:/g,
  borderIndividual: /border(Top|Right|Bottom|Left|Width|Style|Color)\s*:/g,
  margin: /margin\s*:/g,
  marginIndividual: /margin(Top|Right|Bottom|Left)\s*:/g,
  padding: /padding\s*:/g,
  paddingIndividual: /padding(Top|Right|Bottom|Left)\s*:/g,
  font: /font\s*:/g,
  fontIndividual: /font(Size|Weight|Family|Style|Variant)\s*:/g,
  background: /background\s*:/g,
  backgroundIndividual: /background(Color|Image|Repeat|Position|Size)\s*:/g,
};

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const conflicts = [];

  // Check for border conflicts
  if (conflictPatterns.border.test(content) && conflictPatterns.borderIndividual.test(content)) {
    conflicts.push('border shorthand mixed with individual border properties');
  }

  // Check for margin conflicts
  if (conflictPatterns.margin.test(content) && conflictPatterns.marginIndividual.test(content)) {
    conflicts.push('margin shorthand mixed with individual margin properties');
  }

  // Check for padding conflicts
  if (conflictPatterns.padding.test(content) && conflictPatterns.paddingIndividual.test(content)) {
    conflicts.push('padding shorthand mixed with individual padding properties');
  }

  // Check for font conflicts
  if (conflictPatterns.font.test(content) && conflictPatterns.fontIndividual.test(content)) {
    conflicts.push('font shorthand mixed with individual font properties');
  }

  // Check for background conflicts
  if (conflictPatterns.background.test(content) && conflictPatterns.backgroundIndividual.test(content)) {
    conflicts.push('background shorthand mixed with individual background properties');
  }

  return conflicts;
}

function scanDirectory(directory) {
  const files = glob.sync(`${directory}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*']
  });

  const results = [];

  files.forEach(file => {
    const conflicts = checkFile(file);
    if (conflicts.length > 0) {
      results.push({
        file: path.relative(process.cwd(), file),
        conflicts
      });
    }
  });

  return results;
}

// Main execution
function main() {
  console.log('🔍 Scanning for CSS property conflicts...\n');
  
  const results = scanDirectory('apps/frontend/src');

  if (results.length > 0) {
    console.log('🚨 CSS Property Conflicts Found:');
    results.forEach(({ file, conflicts }) => {
      console.log(`\n📁 ${file}`);
      conflicts.forEach(conflict => {
        console.log(`  ⚠️  ${conflict}`);
      });
    });
    
    console.log(`\n📊 Summary: ${results.length} files with conflicts found`);
    console.log('\n💡 Run "npm run lint:css-conflicts:fix" to see suggested fixes');
    process.exit(1);
  } else {
    console.log('✅ No CSS property conflicts found!');
    console.log('🎉 All components are using consistent CSS property patterns');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkFile, scanDirectory };
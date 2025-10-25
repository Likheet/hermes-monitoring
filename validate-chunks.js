const fs = require('fs');
const path = require('path');

console.log('=== Next.js Vendor Chunk Validation ===\n');

// Check vendor chunks directory
const vendorChunksPath = '.next/server/vendor-chunks';
console.log('1. Checking vendor chunks directory...');

if (!fs.existsSync(vendorChunksPath)) {
  console.log('❌ Vendor chunks directory does not exist');
  process.exit(1);
}

const files = fs.readdirSync(vendorChunksPath);
console.log(`✅ Found ${files.length} files in vendor-chunks:\n`);

files.forEach(file => {
  console.log(`   - ${file}`);
});

// Check for the specific missing chunk
const expectedChunk = 'next@15.2.4_@babel+core@7.2_1bbbc4217b9f9fe7035e079603c1652e.js';
const actualChunk = files.find(f => f.includes('next@15.2.4') && f.includes('@babel+core'));

console.log('\n2. Chunk Analysis:');
console.log(`Expected: ${expectedChunk}`);
console.log(`Actual:   ${actualChunk || 'NOT FOUND'}`);

if (actualChunk && actualChunk !== expectedChunk) {
  console.log('❌ Filename mismatch detected!');
  console.log(`Expected version: @babel+core@7.2`);
  console.log(`Actual version:   ${actualChunk.match(/@babel\+core@([^_]+)/)?.[1] || 'UNKNOWN'}`);
} else if (!actualChunk) {
  console.log('❌ No Next.js Babel core chunk found!');
} else {
  console.log('✅ Chunk filename matches expected');
}

// Check package.json for Babel version
console.log('\n3. Babel Version Check:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const pnpmLock = fs.readFileSync('pnpm-lock.yaml', 'utf8');
  
  const babelVersionMatch = pnpmLock.match(/@babel\/core@([0-9.]+)/);
  const babelVersion = babelVersionMatch ? babelVersionMatch[1] : 'UNKNOWN';
  
  console.log(`Babel core version in pnpm-lock.yaml: ${babelVersion}`);
  console.log(`Expected in chunk filename: 7.2`);
  
  if (babelVersion !== '7.2') {
    console.log('❌ Version mismatch between lockfile and chunk filename!');
  } else {
    console.log('✅ Versions match');
  }
} catch (error) {
  console.log('❌ Error reading version info:', error.message);
}

// Check webpack runtime
console.log('\n4. Webpack Runtime Check:');
try {
  const webpackRuntime = fs.readFileSync('.next/server/webpack-runtime.js', 'utf8');
  const requireFunction = webpackRuntime.match(/__webpack_require__\.f\.require = \(chunkId, promises\) => \{[\s\S]*?require\("\.\/" \+ __webpack_require__\.u\(chunkId\)\)/);
  
  if (requireFunction) {
    console.log('✅ Webpack require function found');
    console.log('Pattern: require("./" + __webpack_require__.u(chunkId))');
  } else {
    console.log('❌ Webpack require function pattern not found');
  }
} catch (error) {
  console.log('❌ Error reading webpack runtime:', error.message);
}

console.log('\n=== Validation Complete ===');

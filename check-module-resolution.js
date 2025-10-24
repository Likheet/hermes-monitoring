const fs = require('fs');
const path = require('path');

console.log('=== Module Resolution Deep Dive ===\n');

// Check if the vendor chunk file actually exists and is readable
const chunkPath = '.next/server/vendor-chunks/next@15.2.4_@babel+core@7.2_1bbbc4217b9f9fe7035e079603c1652e.js';
console.log('1. File Accessibility Check:');

try {
  const stats = fs.statSync(chunkPath);
  console.log(`✅ File exists: ${chunkPath}`);
  console.log(`   Size: ${stats.size} bytes`);
  console.log(`   Modified: ${stats.mtime}`);
  
  // Check if file is empty or corrupted
  if (stats.size === 0) {
    console.log('❌ File is empty!');
  } else {
    console.log('✅ File has content');
  }
} catch (error) {
  console.log(`❌ File access error: ${error.message}`);
}

// Check webpack runtime's require function more deeply
console.log('\n2. Webpack Runtime Analysis:');
try {
  const webpackRuntime = fs.readFileSync('.next/server/webpack-runtime.js', 'utf8');
  
  // Look for the specific require pattern that's failing
  const requirePattern = /__webpack_require__\.f\.require = \(chunkId, promises\) => \{[\s\S]*?require\("\.\/" \+ __webpack_require__\.u\(chunkId\)\)/;
  const match = webpackRuntime.match(requirePattern);
  
  if (match) {
    console.log('✅ Found require function pattern');
    console.log('Pattern attempts to: require("./" + chunkId + ".js")');
    
    // Check what chunkId would be passed
    console.log('\n3. Chunk ID Analysis:');
    console.log('Expected chunkId: next@15.2.4_@babel+core@7.2_1bbbc4217b9f9fe7035e079603c1652e');
    
    // Simulate the require call
    const simulatedPath = './' + 'next@15.2.4_@babel+core@7.2_1bbbc4217b9f9fe7035e079603c1652e' + '.js';
    console.log(`Simulated require path: ${simulatedPath}`);
    
    // Check if this path would resolve
    const resolvedPath = path.resolve('.next/server/vendor-chunks/', 'next@15.2.4_@babel+core@7.2_1bbbc4217b9f9fe7035e079603c1652e.js');
    console.log(`Resolved path: ${resolvedPath}`);
    
    if (fs.existsSync(resolvedPath)) {
      console.log('✅ Path resolves correctly');
    } else {
      console.log('❌ Path does not resolve!');
    }
  } else {
    console.log('❌ Require pattern not found');
  }
} catch (error) {
  console.log(`❌ Runtime analysis error: ${error.message}`);
}

// Check for any encoding or special character issues
console.log('\n4. Filename Encoding Check:');
const filename = 'next@15.2.4_@babel+core@7.2_1bbbc4217b9f9fe7035e079603c1652e.js';
console.log(`Filename bytes: ${Buffer.from(filename).length}`);
console.log(`Filename characters: ${filename.length}`);
console.log(`Contains special chars: ${/[+@]/.test(filename) ? 'YES' : 'NO'}`);

// Check the actual error stack trace location
console.log('\n5. Error Context Analysis:');
console.log('Error occurs in:');
console.log('- .next/server/webpack-runtime.js:198:28');
console.log('- .next/server/app/_not-found/page.js:694:47');
console.log('This suggests the _not-found page is trying to load the vendor chunk');

console.log('\n=== Analysis Complete ===');
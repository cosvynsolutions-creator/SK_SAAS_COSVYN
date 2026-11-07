const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'node_modules/@firebase/firestore/dist/index.esm2017.js',
  'node_modules/@firebase/firestore/dist/index.cjs.js',
  'node_modules/@firebase/firestore/dist/index.rn.js',
  'node_modules/@firebase/firestore/dist/index.node.cjs.js',
  'node_modules/@firebase/firestore/dist/index.node.mjs',
  'node_modules/.vite/deps/firebase_firestore.js'
];

let totalPatched = 0;

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Pattern 1: this.pe -= 1, __PRIVATE_hardAssert(this.pe >= 0);
  if (content.includes('this.pe -= 1, __PRIVATE_hardAssert(this.pe >= 0);')) {
    content = content.replace(
      /this\.pe -= 1, __PRIVATE_hardAssert\(this\.pe >= 0\);/g,
      'this.pe = Math.max(0, this.pe - 1);'
    );
    modified = true;
  }

  // Pattern 2: this.pendingResponses -= 1; ... hardAssert(this.pendingResponses >= 0);
  if (content.includes('hardAssert(this.pendingResponses >= 0);')) {
    content = content.replace(
      /this\.pendingResponses -= 1;[\s\n]*hardAssert\(this\.pendingResponses >= 0\);/g,
      'this.pendingResponses = Math.max(0, this.pendingResponses - 1);'
    );
    modified = true;
  }

  // Pattern 3: Prevent circular structure errors (Y2/Ka) in __PRIVATE_argToString
  if (content.includes('__PRIVATE_formatJSON') || content.includes('Converting to JSON failed, just log the object directly')) {
    content = content.replace(
      /\/\/ Converting to JSON failed, just log the object directly[\s\n]*return e;/g,
      'return (e && e.message) ? e.message : String(e);'
    );
    content = content.replace(
      /\}\s*catch\s*\([a-zA-Z0-9_]*\)\s*\{\s*return\s+e\s*;\s*\}/g,
      '} catch (_err) { return (e && e.message) ? e.message : String(e); }'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-firestore] Patched: ${relPath}`);
    totalPatched++;
  }
}

console.log(`[patch-firestore] Done. Patched ${totalPatched} files.`);

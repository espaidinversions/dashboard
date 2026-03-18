// Warn-only JSX/JS syntax checker using @babel/parser (already in node_modules).
// Invoked by PostToolUse hook after Edit/Write on any file.
// Always exits 0 (non-blocking).
'use strict';
const path = require('path');
const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) process.exit(0);

const ext = path.extname(filePath).toLowerCase();
if (ext !== '.js' && ext !== '.jsx') process.exit(0);

let code;
try { code = fs.readFileSync(filePath, 'utf8'); }
catch { process.exit(0); }

let parser;
try {
  parser = require(path.join(__dirname, '../../node_modules/@babel/parser'));
} catch { process.exit(0); } // silently skip if @babel/parser not found

try {
  parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
} catch (err) {
  console.log(`⚠ Syntax warning in ${filePath}:\n  ${err.message}`);
}
process.exit(0);

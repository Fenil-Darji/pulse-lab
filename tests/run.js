// Signal-processing checks for the Sleep, Cough, Hearing, Vision and Movement tabs.
// They read the code straight out of index.html. Run from the repository root:  node tests/run.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = /\/\/ VX-START\n([\s\S]*?)\/\/ VX-END/.exec(html);
if (!m) { console.error('VX block not found in index.html'); process.exit(1); }
const VX = new Function('module', m[1] + '\nreturn VX;')({});
let fail = 0;
const ok = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); if (!cond) fail++; };
for (const f of fs.readdirSync(__dirname).filter((f) => /\.js$/.test(f) && f !== 'run.js').sort()) {
  const want = f.slice(0, -3);
  if (!VX[want]) continue;
  require(path.join(__dirname, f))(VX, ok);
}
console.log(fail ? fail + ' FAILED' : 'all passed');
process.exit(fail ? 1 : 0);

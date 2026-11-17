// Signal-processing checks. Run from the repository root after building:  node src/test-core.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = /\/\/ VX-START\n([\s\S]*?)\/\/ VX-END/.exec(html);
if (!m) { console.error('VX block not found: build first'); process.exit(1); }
const VX = new Function('module', m[1] + '\nreturn VX;')({});
let fail = 0;
const ok = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); if (!cond) fail++; };
for (const f of fs.readdirSync(__dirname).filter((f) => /^test-.+\.js$/.test(f) && f !== 'test-core.js').sort()) {
  const want = f.slice(5, -3);
  if (!VX[want]) continue;
  require(path.join(__dirname, f))(VX, ok);
}
console.log(fail ? fail + ' FAILED' : 'all passed');
process.exit(fail ? 1 : 0);

/**
 * Patches react-native-web to skip numeric style keys.
 * Chrome 125+ throws when CSSStyleDeclaration indexed setters are used (e.g. style["0"]).
 * React Native StyleSheet.create returns numeric IDs which can leak through as style keys.
 *
 * Patches both the CJS and module (ESM) builds since Metro uses the module field.
 */
const fs = require('fs');
const path = require('path');

const TARGETS = [
  'node_modules/react-native-web/dist/cjs/modules/setValueForStyles/index.js',
  'node_modules/react-native-web/dist/modules/setValueForStyles/index.js',
];

const FROM = 'style[styleName] = styleValue;';
const TO = 'if (isNaN(Number(styleName))) { style[styleName] = styleValue; }';

let patched = 0;
let already = 0;
let missing = 0;

for (const rel of TARGETS) {
  const filePath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Not found: ${rel}`);
    missing++;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(TO)) {
    console.log(`✅ Already patched: ${rel}`);
    already++;
  } else if (content.includes(FROM)) {
    fs.writeFileSync(filePath, content.replace(FROM, TO));
    console.log(`✅ Patched: ${rel}`);
    patched++;
  } else {
    console.log(`⚠️  Pattern not found in: ${rel}`);
    missing++;
  }
}

console.log(`\nDone. Patched: ${patched}, Already done: ${already}, Skipped: ${missing}`);

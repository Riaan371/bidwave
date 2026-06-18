/**
 * Patches React DOM and react-native-web to skip numeric style property names.
 *
 * Root cause: Chrome 125+ throws "Indexed property setter is not supported" when
 * code does element.style["0"] = value. This happens because:
 *   - react-native-web's StyleSheet.create stores compiled styles in a WeakMap
 *   - The styleq resolver processes style arrays and can leak numeric array indices
 *     as CSS property keys when the style is passed through as-is
 *   - These numeric keys reach React DOM's setValueForStyle which calls
 *     element.style["0"] = value → Chrome 125+ throws
 *
 * Patches all relevant files.
 */
const fs = require('fs');
const path = require('path');

const PATCHES = [
  // react-native-web CJS build (used by some paths)
  {
    file: 'node_modules/react-native-web/dist/cjs/modules/setValueForStyles/index.js',
    from: 'style[styleName] = styleValue;',
    to: 'if (isNaN(Number(styleName))) { style[styleName] = styleValue; }',
  },
  // react-native-web ESM build (used by Metro for web bundles)
  {
    file: 'node_modules/react-native-web/dist/modules/setValueForStyles/index.js',
    from: 'style[styleName] = styleValue;',
    to: 'if (isNaN(Number(styleName))) { style[styleName] = styleValue; }',
  },
  // React DOM client production — setValueForStyle (called for every style prop on DOM elements)
  {
    file: 'node_modules/react-dom/cjs/react-dom-client.production.js',
    from: 'function setValueForStyle(style, styleName, value) {\n  var isCustomProperty',
    to: 'function setValueForStyle(style, styleName, value) {\n  if (!isNaN(Number(styleName))) return;\n  var isCustomProperty',
  },
  // React DOM development build (used in dev/test) — has different indentation
  {
    file: 'node_modules/react-dom/cjs/react-dom-client.development.js',
    from: '    function setValueForStyle(style, styleName, value) {\n      var isCustomProperty',
    to: '    function setValueForStyle(style, styleName, value) {\n      if (!isNaN(Number(styleName))) return;\n      var isCustomProperty',
  },
];

let patched = 0;
let already = 0;
let missing = 0;

for (const { file, from, to } of PATCHES) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Not found: ${file}`);
    missing++;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(to)) {
    console.log(`✅ Already patched: ${file}`);
    already++;
  } else if (content.includes(from)) {
    fs.writeFileSync(filePath, content.replace(from, to));
    console.log(`✅ Patched: ${file}`);
    patched++;
  } else {
    console.log(`⚠️  Pattern not found in: ${file}`);
    missing++;
  }
}

console.log(`\nDone. Patched: ${patched}, Already done: ${already}, Skipped: ${missing}`);

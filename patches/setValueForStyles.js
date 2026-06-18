'use strict';
// Patched version of react-native-web's setValueForStyles.
// Chrome 125+ does not allow indexed property setters on CSSStyleDeclaration
// (e.g. style["0"] = value throws). This happens when a numeric React Native
// StyleSheet ID leaks through as a CSS key. We skip any numeric key.
const dangerousStyleValue = require('react-native-web/dist/cjs/modules/setValueForStyles/dangerousStyleValue');
const _dsv = dangerousStyleValue.default || dangerousStyleValue;

function setValueForStyles(node, styles) {
  var style = node.style;
  for (var styleName in styles) {
    if (!styles.hasOwnProperty(styleName)) continue;
    // Skip numeric keys — they are unresolved StyleSheet IDs, not CSS properties.
    if (!isNaN(Number(styleName))) continue;
    var isCustomProperty = styleName.indexOf('--') === 0;
    var styleValue = _dsv(styleName, styles[styleName], isCustomProperty);
    if (styleName === 'float') styleName = 'cssFloat';
    if (isCustomProperty) {
      style.setProperty(styleName, styleValue);
    } else {
      style[styleName] = styleValue;
    }
  }
}

module.exports = setValueForStyles;
module.exports.default = setValueForStyles;

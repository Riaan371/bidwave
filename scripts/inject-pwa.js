const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const pwaTags = `
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="WC Pickers">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icon-192-v4.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512-v4.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192-v4.png">
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(function(e) {
          console.warn('SW registration failed:', e);
        });
      });
    }
  </script>`;

html = html.replace('</head>', pwaTags + '\n</head>');

// Also fix description
html = html.replace(
  'content="South Africa\'s live &amp; timed auction marketplace. Bid on vehicles, livestock, property, electronics and more."',
  'content="West Coast Pickers — South Africa\'s live auction marketplace."'
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('PWA tags injected into dist/index.html');

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  let html = await response.text();

  const inject = `
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="WC Pickers">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icon-192-v3.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512-v3.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192-v3.png">
  <script>if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>`;

  html = html.replace('</head>', inject + '\n</head>');

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');

  return new Response(html, { status: response.status, headers });
}

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-ZA">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>West Coast Pickers — Live Auctions</title>
        <meta name="description" content="West Coast Pickers — South Africa's live auction marketplace. Bid on vehicles, livestock, property, electronics and more." />

        {/* PWA */}
        <meta name="theme-color" content="#0D1B2A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WC Pickers" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192-v2.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512-v2.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192-v2.png" />

        {/* OneSignal Web Push */}
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer />
        <script dangerouslySetInnerHTML={{ __html: `
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          OneSignalDeferred.push(async function(OneSignal) {
            await OneSignal.init({
              appId: "e7382b34-2b96-4f8e-97db-7ef9505ae8c3",
              notifyButton: { enable: false },
              promptOptions: {
                slidedown: {
                  prompts: [{
                    type: "push",
                    autoPrompt: true,
                    text: {
                      actionMessage: "Get notified when West Coast Pickers goes live or schedules a new auction.",
                      acceptButton: "Allow",
                      cancelButton: "No thanks"
                    },
                    delay: { pageViews: 1, timeDelay: 5 }
                  }]
                }
              }
            });
          });
        `}} />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(e) {
                console.warn('SW registration failed:', e);
              });
            });
          }
        `}} />
      </body>
    </html>
  );
}

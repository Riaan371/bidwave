const APP_ID = 'e7382b34-2b96-4f8e-97db-7ef9505ae8c3';

export function initOneSignal() {
  if (typeof window === 'undefined') return;
  if ((window as any).__oneSignalInitialized) return;
  (window as any).__oneSignalInitialized = true;

  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  document.head.appendChild(script);

  (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
  (window as any).OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.init({
      appId: APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    });
  });
}

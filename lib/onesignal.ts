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
      serviceWorkerPath: 'sw.js',
      serviceWorkerParam: { scope: '/' },
    });
  });
}

// Returns 'granted' | 'denied' | 'default'
export async function getNotificationPermission(): Promise<string> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

// Triggers the real native browser permission prompt (must be called from a user gesture, e.g. onPress)
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return false;
  try {
    await OneSignal.Notifications.requestPermission();
    return Notification.permission === 'granted';
  } catch {
    return false;
  }
}

// Tags this device's push subscription with the logged-in app user's ID,
// so notifications can be targeted at a specific person with certainty.
export async function linkOneSignalToUser(userId: string) {
  if (typeof window === 'undefined') return;
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;
  try {
    await OneSignal.login(userId);
  } catch {
    // ignore — SDK may not be ready yet, harmless to skip
  }
}

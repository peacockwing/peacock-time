import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const PRIMED_KEY = 'peacock_native_permissions_primed';

// Asks for microphone (voice commands) and camera (photo AI) access once,
// together, right after the app opens - so the OS's "Allow while using the
// app" dialogs appear as a single onboarding moment instead of popping up
// piecemeal the first time each feature is used.
export async function primeNativePermissionsOnce() {
  if (!Capacitor.isNativePlatform()) return;
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(PRIMED_KEY) === 'true') return;

  try {
    await SpeechRecognition.requestPermissions();
  } catch (e) {
    /* ignore - voice commands will just no-op if denied */
  }
  try {
    await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  } catch (e) {
    /* ignore - photo capture falls back to the file picker if denied */
  }

  localStorage.setItem(PRIMED_KEY, 'true');
}

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

// Android's WebView (unlike the standalone Chrome app) never implemented the
// Web Speech API - window.SpeechRecognition/webkitSpeechRecognition is
// either undefined or silently non-functional there, which is why voice
// commands worked in a browser tab but not in the native app. This module
// routes native builds through the community plugin (real Android
// SpeechRecognizer / iOS SFSpeechRecognizer) instead.
export const isNativeApp = () => Capacitor.isNativePlatform();

export async function ensureVoicePermission(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const check = await SpeechRecognition.checkPermissions();
    if (check.speechRecognition === 'granted') return true;
    const req = await SpeechRecognition.requestPermissions();
    return req.speechRecognition === 'granted';
  } catch (e) {
    return false;
  }
}

// Resolves with one recognized utterance (Korean), or '' on silence/denial/
// error - callers loop this for continuous wake-word style listening.
export async function listenOnceNative(): Promise<string> {
  try {
    const result = await SpeechRecognition.start({
      language: 'ko-KR',
      maxResults: 1,
      partialResults: false,
      popup: false,
    });
    return result?.matches?.[0] || '';
  } catch (e) {
    return '';
  }
}

export async function stopNativeListening() {
  try {
    await SpeechRecognition.stop();
  } catch (e) {
    /* ignore */
  }
}

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const isNativeApp = () => Capacitor.isNativePlatform();

// Native camera capture, used instead of the <input type=file capture> web
// fallback when running in the app - returns a base64 JPEG string (no data:
// URL prefix) sized to match the same payload-size ceiling imageResize.ts
// applies to web uploads.
export async function takePhotoNative(): Promise<{ data: string; mediaType: string } | null> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    quality: 80,
    width: 1568,
  });
  if (!photo.base64String) return null;
  return { data: photo.base64String, mediaType: `image/${photo.format || 'jpeg'}` };
}

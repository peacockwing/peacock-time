// Resizes/recompresses a photo client-side before it's sent to the server.
// Two reasons this matters: phone camera photos (often 3-8MB+) can exceed
// Vercel's ~4.5MB serverless function request-body limit once base64-encoded
// (+33% overhead), and Claude's vision pricing scales with image resolution -
// a bottle/diaper photo doesn't need multi-megapixel detail to be legible.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.8;

export const resizeImageForUpload = (file: File): Promise<{ data: string; mediaType: string }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('캔버스를 사용할 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const [, data] = dataUrl.split(',');
      resolve({ data, mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };
    img.src = objectUrl;
  });

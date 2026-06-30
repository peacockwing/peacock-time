import crypto from 'crypto';

const defaultSocketPort = process.env.SOCKET_PORT || '3001';
const socketUrl = process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || `http://localhost:${defaultSocketPort}`;
const socketSecret = process.env.SOCKET_SECRET;

if (!socketSecret) {
  console.warn('Socket broadcast helper: SOCKET_SECRET is not configured. Broadcasts will be skipped.');
}

const safeCompare = (a: string, b: string) => {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
};

export type SocketBroadcastAction = 'new_log' | 'update_log' | 'delete_log' | 'tabs_update';

export async function broadcastSocketAction(action: SocketBroadcastAction, familyCode: string, payload: unknown) {
  if (!socketSecret) {
    throw new Error('Socket broadcast is disabled because SOCKET_SECRET is not configured.');
  }

  if (!socketUrl) {
    throw new Error('Socket broadcast destination is not configured. Set SOCKET_URL or NEXT_PUBLIC_SOCKET_URL.');
  }

  const body = JSON.stringify({ action, familyCode, payload });
  const signature = crypto.createHmac('sha256', socketSecret).update(body).digest('hex');

  const response = await fetch(`${socketUrl}/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-socket-secret': socketSecret,
      'x-socket-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Socket broadcast failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response;
}

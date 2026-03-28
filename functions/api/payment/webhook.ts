interface Env {
  RAZORPAY_WEBHOOK_SECRET?: string;
  BOOKINGS_KV?: { put: (key: string, value: string) => Promise<unknown> };
}

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { error };
  }
};

const constantTimeCompare = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ message: 'Missing RAZORPAY_WEBHOOK_SECRET configuration' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expectedSignature = toHex(digest);

  if (!signature || !constantTimeCompare(signature, expectedSignature)) {
    return new Response(JSON.stringify({ message: 'Invalid webhook signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = safeJsonParse(rawBody);
  if ('error' in payload) {
    return new Response(JSON.stringify({ message: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const paymentEntity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity;
  const bookingId = paymentEntity?.notes?.bookingId || 'unknown-booking';
  const bookingUpdate = {
    bookingId,
    paymentId: paymentEntity?.id,
    status: payload?.event,
    amount: paymentEntity?.amount,
    currency: paymentEntity?.currency,
    receivedAt: new Date().toISOString(),
  };

  if (env.BOOKINGS_KV && 'put' in env.BOOKINGS_KV && typeof env.BOOKINGS_KV.put === 'function') {
    await env.BOOKINGS_KV.put(bookingId, JSON.stringify(bookingUpdate));
  }

  console.log('[Webhook] Processed Razorpay event', bookingUpdate);

  return new Response(JSON.stringify({ success: true, booking: bookingUpdate }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Central client config. Next inlines `NEXT_PUBLIC_*` at build time; read them only here.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is required');

// Cloudflare Turnstile site key, or `off` where the server runs CAPTCHA_PROVIDER=off (dev, tests).
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
if (!turnstileSiteKey) throw new Error('NEXT_PUBLIC_TURNSTILE_SITE_KEY is required (or "off")');

export const config = {
  apiUrl,
  turnstileSiteKey: turnstileSiteKey === 'off' ? null : turnstileSiteKey,
};

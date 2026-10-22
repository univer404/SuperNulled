import { router, json, error, secrets } from '@appdeploy/sdk';

export const handler = router({
    'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
    'GET /api/turnstile/status': [async () => {
        const names = await secrets.listSecretNames();
        return json({ secretConfigured: names.includes('TURNSTILE_SECRET_KEY') });
    }],
    'POST /api/turnstile/verify': [async ({ body }) => {
        const payload = body && typeof body === 'object' ? body as { token?: unknown } : {};
        if (typeof payload.token !== 'string' || payload.token.length < 1 || payload.token.length > 4096) {
            return error('A valid Cloudflare verification token is required.', 400);
        }
        let secret: string;
        try {
            secret = await secrets.readSecret('TURNSTILE_SECRET_KEY');
        } catch {
            return error('Cloudflare Turnstile is not fully configured by the administrator.', 503);
        }
        const form = new URLSearchParams({ secret, response: payload.token });
        try {
            const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
            });
            if (!response.ok) return error('Cloudflare verification service is temporarily unavailable.', 502);
            const result = await response.json() as { success?: boolean };
            return result.success ? json({ verified: true }) : error('Cloudflare verification failed. Please try again.', 403);
        } catch {
            return error('Could not contact Cloudflare verification. Please try again.', 502);
        }
    }],
});

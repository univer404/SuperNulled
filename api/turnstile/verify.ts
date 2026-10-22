import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ verified: false, error: 'Method not allowed' });
    }

    const token = req.body?.token;
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (typeof token !== 'string' || !token || !secret) {
        return res.status(400).json({ verified: false });
    }

    try {
        const verification = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    secret,
                    response: token,
                }),
            }
        );

        const result = await verification.json() as { success?: boolean };

        return res.status(200).json({
            verified: result.success === true,
        });
    } catch {
        return res.status(502).json({ verified: false });
    }
}

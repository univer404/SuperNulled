import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
        secretConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY),
    });
}

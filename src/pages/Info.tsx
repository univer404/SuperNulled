import { Link } from 'react-router-dom';
import { usePublicSettings } from '../lib/settings';

const PAGES = {
    about: { title: 'About SuperNulled', body: ['SuperNulled is a digital resource marketplace for Minecraft plugins, Skripts, configurations, maps, server setups and resource packs.', 'Every resource is uploaded and published by the site owner.'] },
    support: { title: 'Support', body: ['Need help with a purchase or download? Reach out using the contact details below.'] },
    terms: { title: 'Terms of Service', body: ['Draft — to be reviewed by the site owner before launch.', 'By using SuperNulled you agree to use purchased resources only according to their stated license, and not to redistribute them.', 'Accounts that abuse the service may be suspended.'] },
    privacy: { title: 'Privacy Policy', body: ['Draft — to be reviewed by the site owner before launch.', 'We store your email, display name, purchases and downloads to run your account. Payments are handled by a payment provider; card details never reach SuperNulled.'] },
    refunds: { title: 'Refund Policy', body: ['Draft — to be reviewed by the site owner before launch.', 'Because resources are digital, refund requests are reviewed case by case. Open your Purchase History to request a refund for a paid order.'] },
} as const;

export type InfoKey = keyof typeof PAGES;

export default function Info({ page }: { page: InfoKey }) {
    const content = PAGES[page];
    const { supportContact } = usePublicSettings();
    return (
        <div className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-4 text-3xl font-bold">{content.title}</h1>
            <div className="space-y-3 text-zinc-300">
                {content.body.map((text) => <p key={text}>{text}</p>)}
                {page === 'support' && <p className="font-medium text-[#C4B5FD]">{supportContact || 'Contact details have not been published yet.'}</p>}
            </div>
            <Link to="/" className="btn-ghost mt-8">Back to home</Link>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface PublicSettings { siteName: string; siteDescription: string; announcement: string; supportContact: string; maintenance: boolean }

const DEFAULT_SETTINGS: PublicSettings = { siteName: 'SuperNulled', siteDescription: 'Minecraft plugins, Skripts, maps, configs, server setups and resource packs.', announcement: '', supportContact: '', maintenance: false };

// Only site_settings keys starting with 'public.' are readable by visitors (enforced by RLS).
export function usePublicSettings(): PublicSettings {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    useEffect(() => {
        supabase.from('site_settings').select('key,value').like('key', 'public.%').then(({ data }) => {
            const values = Object.fromEntries((data ?? []).map((row) => [row.key as string, row.value as unknown]));
            const text = (key: string) => (typeof values[key] === 'string' ? (values[key] as string) : '');
            setSettings({ siteName: text('public.site_name') || DEFAULT_SETTINGS.siteName, siteDescription: text('public.site_description') || DEFAULT_SETTINGS.siteDescription, announcement: text('public.announcement'), supportContact: text('public.support_contact'), maintenance: values['public.maintenance'] === true });
        });
    }, []);

    return settings;
}

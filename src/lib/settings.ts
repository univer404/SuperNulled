import { useEffect, useState } from 'react';
import { supabase } from './supabase';

let cachedSettings: PublicSettings | null = (() => {
    try {
        const saved = localStorage.getItem('supernulled-public-settings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) as Partial<PublicSettings> } : null;
    } catch { return null; }
})();
let settingsPromise: Promise<PublicSettings> | null = null;
const listeners = new Set<(settings: PublicSettings) => void>();

export interface PublicSettings { siteName: string; siteDescription: string; announcement: string; supportContact: string; maintenance: boolean }

const DEFAULT_SETTINGS: PublicSettings = { siteName: 'SuperNulled', siteDescription: 'Minecraft plugins, Skripts, maps, configs, server setups and resource packs.', announcement: '', supportContact: '', maintenance: false };

// Share one settings request and cache the result so every Logo does not flash the default name on refresh.
export function loadPublicSettings(): Promise<PublicSettings> {
    if (cachedSettings) return Promise.resolve(cachedSettings);
    if (!settingsPromise) {
        settingsPromise = supabase.from('site_settings').select('key,value').like('key', 'public.%').then(({ data }) => {
            const values = Object.fromEntries((data ?? []).map((row) => [row.key as string, row.value as unknown]));
            const text = (key: string, fallback = '') => typeof values[key] === 'string' ? values[key] as string : fallback;
            cachedSettings = {
                siteName: text('public.site_name', DEFAULT_SETTINGS.siteName) || DEFAULT_SETTINGS.siteName,
                siteDescription: text('public.site_description', DEFAULT_SETTINGS.siteDescription) || DEFAULT_SETTINGS.siteDescription,
                announcement: text('public.announcement'),
                supportContact: text('public.support_contact'),
                maintenance: values['public.maintenance'] === true,
            };
            try { localStorage.setItem('supernulled-public-settings', JSON.stringify(cachedSettings)); } catch { /* Storage may be unavailable; memory cache still works. */ }
            listeners.forEach((listener) => listener(cachedSettings!));
            return cachedSettings;
        }).catch(() => DEFAULT_SETTINGS).finally(() => { settingsPromise = null; });
    }
    return settingsPromise;
}

export function usePublicSettings(): PublicSettings {
    const [settings, setSettings] = useState<PublicSettings>(cachedSettings ?? DEFAULT_SETTINGS);

    useEffect(() => {
        let active = true;
        const listener = (next: PublicSettings) => { if (active) setSettings(next); };
        listeners.add(listener);
        loadPublicSettings().then((next) => { if (active) setSettings(next); });
        return () => { active = false; listeners.delete(listener); };
    }, []);

    return settings;
}

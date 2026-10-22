import { supabase } from './supabase';

// Calls an Edge Function and turns its JSON error body into a readable Error message.
export async function invokeFunction<T>(name: string, body: object): Promise<T> {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
        let message = 'Something went wrong. Please try again.';
        const context = (error as { context?: Response }).context;
        if (context) {
            const payload = await context.json().catch(() => null);
            if (payload?.error) message = String(payload.error);
        }
        throw new Error(message);
    }
    return data as T;
}

export async function startDownload(resourceId: string): Promise<void> {
    const { url } = await invokeFunction<{ url: string }>('download-resource', { resource_id: resourceId });
    window.location.href = url;
}

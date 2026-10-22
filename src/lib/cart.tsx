import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartItem { id: string; slug: string; title: string; price: number }

interface CartState {
    items: CartItem[];
    add: (item: CartItem) => void;
    remove: (id: string) => void;
    clear: () => void;
    has: (id: string) => boolean;
}

const STORAGE_KEY = 'supernulled-cart';
const CartContext = createContext<CartState | null>(null);

function readStoredItems(): CartItem[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
        return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
    } catch {
        return [];
    }
}

// The cart only remembers what to show. Prices are always re-read from the database at checkout.
export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>(readStoredItems);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage unavailable: cart lives in memory only */ }
    }, [items]);

    const add = useCallback((item: CartItem) => setItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item])), []);
    const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);
    const clear = useCallback(() => setItems([]), []);
    const has = useCallback((id: string) => items.some((p) => p.id === id), [items]);
    const value = useMemo(() => ({ items, add, remove, clear, has }), [items, add, remove, clear, has]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used inside CartProvider');
    return context;
}

import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { supabase } from './lib/supabase';
import { CartProvider } from './lib/cart';
import Layout from './components/Layout';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Categories from './pages/Categories';
import ResourceDetail from './pages/ResourceDetail';
import AuthPage from './pages/AuthPage';
import ResetPassword from './pages/ResetPassword';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Cart from './pages/Cart';
import CheckoutSuccess from './pages/CheckoutSuccess';
import Info from './pages/Info';
import NotFound from './pages/NotFound';
import { Favorites, Library, PurchaseHistory } from './pages/Collections';

// A password-reset email links back with ?recovery=1; send the visitor to the new-password form.
function RecoveryGate() {
    const navigate = useNavigate();
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('recovery') === '1') {
            window.history.replaceState(null, '', window.location.pathname + window.location.hash);
            navigate('/reset-password', { replace: true });
        }
    }, [navigate]);
    return null;
}

function App() {
    const [authCallbackReady, setAuthCallbackReady] = useState(false);

    useEffect(() => {
        let active = true;
        const hasAuthTokens = /(?:access_token|refresh_token|error_description|error)=/.test(window.location.hash);

        if (!hasAuthTokens) {
            setAuthCallbackReady(true);
            return () => { active = false; };
        }

        // Let Supabase consume the OAuth/email-confirmation tokens before HashRouter reads the hash as a route.
        supabase.auth.getSession().finally(() => {
            if (!active) return;
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
            setAuthCallbackReady(true);
        });

        return () => { active = false; };
    }, []);

    if (!authCallbackReady) {
        return <div className="p-8 text-center text-zinc-400">Finishing sign-in…</div>;
    }

    return (
        <AuthProvider>
            <CartProvider>
                <HashRouter>
                    <RecoveryGate />
                    <Routes>
                        <Route element={<Layout />}>
                            <Route path="/" element={<Home />} />
                            <Route path="/browse" element={<Browse />} />
                            <Route path="/categories" element={<Categories />} />
                            <Route path="/resource/:slug" element={<ResourceDetail />} />
                            <Route path="/cart" element={<Cart />} />
                            <Route path="/checkout/success" element={<CheckoutSuccess />} />
                            <Route path="/login" element={<AuthPage mode="login" />} />
                            <Route path="/register" element={<AuthPage mode="register" />} />
                            <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/account" element={<Account />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/favorites" element={<Favorites />} />
                            <Route path="/orders" element={<PurchaseHistory />} />
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/about" element={<Info page="about" />} />
                            <Route path="/support" element={<Info page="support" />} />
                            <Route path="/terms" element={<Info page="terms" />} />
                            <Route path="/privacy" element={<Info page="privacy" />} />
                            <Route path="/refunds" element={<Info page="refunds" />} />
                            <Route path="*" element={<NotFound />} />
                        </Route>
                    </Routes>
                </HashRouter>
            </CartProvider>
        </AuthProvider>
    );
}

export default App;

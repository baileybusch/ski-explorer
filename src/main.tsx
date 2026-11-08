import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import '@/lib/maplibreSetup';
import App from './App';
import { StaticPage } from '@/pages/StaticPage';
import { ManagePage } from '@/pages/ManagePage';
import { DoNotSellPage } from '@/pages/DoNotSellPage';
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));
import { applyBrandToDocument } from '@/lib/brand';
import './index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

applyBrandToDocument();

const path = location.pathname.replace(/\/$/, '') || '/';
const page = path === '/privacy' ? <StaticPage kind="privacy" />
  : path === '/terms' ? <StaticPage kind="terms" />
    : path === '/disclosure' ? <StaticPage kind="disclosure" />
      : path === '/about' ? <StaticPage kind="about" />
        : path === '/contact' ? <StaticPage kind="contact" />
          : path === '/manage' ? <ManagePage />
            : path === '/my-alerts' ? <ManagePage focus="alerts" />
              : path === '/do-not-sell' ? <DoNotSellPage />
                : path === '/admin' ? <Suspense fallback={null}><AdminPage /></Suspense>
            : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {page}
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>,
);

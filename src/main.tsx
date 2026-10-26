import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import '@/lib/maplibreSetup';
import App from './App';
import { StaticPage } from '@/pages/StaticPage';
import { ManagePage } from '@/pages/ManagePage';
import './index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const path = location.pathname.replace(/\/$/, '') || '/';
const page = path === '/privacy' ? <StaticPage kind="privacy" />
  : path === '/terms' ? <StaticPage kind="terms" />
    : path === '/disclosure' ? <StaticPage kind="disclosure" />
      : path === '/about' ? <StaticPage kind="about" />
        : path === '/contact' ? <StaticPage kind="contact" />
          : path === '/manage' ? <ManagePage />
            : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {page}
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>,
);

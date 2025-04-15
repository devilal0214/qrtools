import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Navigation from '@/components/Navigation';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith('/admin');
  const isDashboardRoute = router.pathname.startsWith('/dashboard');
  const isProfileRoute = router.pathname.startsWith('/profile');

  // Don't show navigation on admin, dashboard, or profile pages
  const showNavigation = !isAdminRoute && !isDashboardRoute && !isProfileRoute;

  return (
    <>
      {showNavigation && <Navigation />}
      <Component {...pageProps} />
    </>
  );
}

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from './AuthModal';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/router';

interface MenuItem {
  name: string;
  href: string;
  icon: JSX.Element;
  requiresAuth?: boolean;
  public?: boolean;
}

export default function Navigation() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      // Clear any auth cookies or local storage if needed
      document.cookie = 'is-admin=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProtectedLink = (path: string) => {
    // Don't navigate if we're already on this route
    if (router.pathname === path) {
      return;
    }

    if (!user) {
      setPendingRedirect(path);
      setShowAuthModal(true);
      return;
    }
    router.push(path);
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    if (pendingRedirect && user) {
      router.push(pendingRedirect);
      setPendingRedirect(null);
    }
  };

  const menuItems: MenuItem[] = [
    {
      name: 'QR Generator',
      href: '/',
      public: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    },
   
    {
      name: 'Short URL',
      href: '/short-url',
      requiresAuth: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    {
      name: 'Virtual Tour',
      href: '/virtual-tour',
      requiresAuth: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Unit Converter',
      href: '/units',
      requiresAuth: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      name: 'Currency Converter',
      href: '/currency',
      requiresAuth: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center text-xl font-bold text-blue-600">
              QR Generator
            </Link>
            
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {menuItems.map(item => (
                <button
                  key={item.href}
                  onClick={() => item.requiresAuth ? handleProtectedLink(item.href) : router.push(item.href)}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 transition-colors
                    ${router.pathname === item.href
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-900 hover:text-blue-600 hover:border-blue-300'
                    }
                  `}
                >
                  {item.icon}
                  <span className="ml-2">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-lg"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="h-8 w-8 rounded-full" />
                    ) : (
                      <span className="text-blue-600 font-medium">
                        {user.displayName?.[0] || user.email?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{user.displayName || 'Account'}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 customZIndex z-50">
                    
                    <Link href="/dashboard/active" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      User Dashboard
                    </Link>
                    
                    
                    <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Profile Settings
                    </Link>

                    
                   
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.href}
              onClick={() => item.requiresAuth ? handleProtectedLink(item.href) : router.push(item.href)}
              className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium
                ${router.pathname === item.href
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {item.icon}
              <span className="ml-2">{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={handleAuthModalClose}
      />
    </nav>
  );
}

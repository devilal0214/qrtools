import { useState, useEffect } from 'react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

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
   
    // {
    //   name: 'Short URL',
    //   href: '/short-url',
    //   requiresAuth: true,
    //   icon: (
    //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    //     </svg>
    //   )
    // },
   
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
      name: 'Time Zone',
      href: '/timezone',
      requiresAuth: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo and Main Menu */}
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center text-xl font-bold text-blue-600">
            <img
            src="/JV_TAPtik.svg"
            alt="Logo"
            style={{ display: "block", width: "140px", height: "auto" }}
             />
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {menuItems.map(item => (
              <button
                key={item.href}
                onClick={() => item.requiresAuth ? handleProtectedLink(item.href) : router.push(item.href)}
                className={`px-3 py-2 text-sm font-medium transition-colors
                  ${router.pathname === item.href
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-900'
                  }
                `}
              >
                {item.name}
              </button>
            ))}
            
            {/* User Menu or Sign In */}
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
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                    <div
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent event bubbling
                       // router.push('/dashboard/active');
                       window.open('/dashboard/active', '_blank'); // Open in new tab
                        setShowProfileMenu(false);
                      }}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      User Dashboard
                    </div>
                    
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/profile');
                        setShowProfileMenu(false);
                      }}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Profile Settings
                    </div>
                    
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSignOut();
                        setShowProfileMenu(false);
                      }}
                      className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      Sign Out
                    </div>
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

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu drawer */}
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-medium">Menu</h2>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-4 py-6">
            {/* Main Menu Items */}
            <div className="space-y-1">
              {menuItems.map(item => (
                <button
                  key={item.href}
                  onClick={() => {
                    if (item.requiresAuth) {
                      handleProtectedLink(item.href);
                    } else {
                      router.push(item.href);
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3
                    ${router.pathname === item.href
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {item.name}
                </button>
              ))}
            </div>

            {/* User Dashboard Menu */}
            {user && (
              <>
                <div className="mt-8 pt-6 border-t">
                  <div className="px-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" />
                        ) : (
                          <span className="text-blue-600 font-medium text-lg">
                            {user.displayName?.[0] || user.email?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.displayName || 'User'}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        router.push('/dashboard/active');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      User Dashboard
                    </button>
                    <button
                      onClick={() => {
                        router.push('/profile');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile Settings
                    </button>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 text-red-600 hover:bg-red-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}

            {!user && (
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={() => {
                    setShowAuthModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={handleAuthModalClose}
      />
    </nav>
  );
}

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import { 
  Timezone, 
  getBrowserTimezone, 
  getTimezoneString, 
  convertTime,
  fetchTimezones 
} from '@/utils/timezones';

export default function TimezonePage() {
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [sourceTimezone, setSourceTimezone] = useState<Timezone | null>(null);
  const [targetTimezone, setTargetTimezone] = useState<Timezone | null>(null);
  const [availableTimezones, setAvailableTimezones] = useState<Timezone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Simplified useEffect for loading timezones
  useEffect(() => {
    const initializeTimezones = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const zones = await fetchTimezones();
        setAvailableTimezones(zones);
        
        // Set initial timezones
        const browserTz = getBrowserTimezone();
        const userTimezone = zones.find(tz => tz.value === browserTz) || zones[0];
        setSourceTimezone(userTimezone);
        
        // Set UTC as default target timezone
        const utcTimezone = zones.find(tz => tz.value === 'UTC') || zones[1];
        setTargetTimezone(utcTimezone);
      } catch (error) {
        console.error('Error loading timezones:', error);
        setError('Failed to load timezone data');
      } finally {
        setLoading(false);
      }
    };

    initializeTimezones();
  }, [user]);

  // Update time conversion when dependencies change
  useEffect(() => {
    if (sourceTimezone && targetTimezone && selectedDate) {
      const sourceDate = new Date(selectedDate);
      const convertedDateTime = convertTime(sourceDate, sourceTimezone, targetTimezone);
      setCurrentTime(convertedDateTime);
    }
  }, [selectedDate, sourceTimezone, targetTimezone]);

  // Enhanced search function
  const filterTimezones = (search: string) => {
    const searchLower = search.toLowerCase();
    return availableTimezones.filter(tz => 
      tz.label.toLowerCase().includes(searchLower) ||
      tz.value.toLowerCase().includes(searchLower) ||
      tz.abbr.toLowerCase().includes(searchLower) ||
      (tz.country && tz.country.toLowerCase().includes(searchLower)) ||
      (tz.utc && tz.utc.some(u => u.toLowerCase().includes(searchLower)))
    );
  };

  const filteredSourceTimezones = useMemo(
    () => filterTimezones(sourceSearch),
    [sourceSearch, availableTimezones]
  );

  const filteredTargetTimezones = useMemo(
    () => filterTimezones(targetSearch),
    [targetSearch, availableTimezones]
  );

  // Convert selected time between timezones
  const convertedTime = useMemo(() => {
    if (!sourceTimezone || !targetTimezone || !selectedDate) return null;
    const sourceDate = new Date(selectedDate);
    return convertTime(sourceDate, sourceTimezone, targetTimezone);
  }, [selectedDate, sourceTimezone, targetTimezone]);

  // Single loading check
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timezone data...</p>
        </div>
      </div>
    );
  }

  // Show error if any
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign in Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to use the Timezone Converter</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Head>
        <title>Timezone Converter</title>
      </Head>

      <div className="w-full max-w-3xl bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">
          Timezone Converter
        </h1>

        {/* Date/Time Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date & Time
          </label>
          <input
            type="datetime-local"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Source Timezone */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Timezone
            </label>
            <div className="relative">
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="Search timezone, country, or UTC offset..."
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {sourceSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredSourceTimezones.map((tz) => (
                    <button
                      key={tz.value}
                      onClick={() => {
                        setSourceTimezone(tz);
                        setSourceSearch('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50"
                    >
                      {getTimezoneString(tz)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sourceTimezone && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{getTimezoneString(sourceTimezone)}</p>
              </div>
            )}
          </div>

          {/* Target Timezone - Similar structure as Source */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">To Timezone</label>
            <div className="relative">
              <input
                type="text"
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
                placeholder="Search timezone, country, or UTC offset..."
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {targetSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredTargetTimezones.map((tz) => (
                    <button
                      key={tz.value}
                      onClick={() => {
                        setTargetTimezone(tz);
                        setTargetSearch('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50"
                    >
                      {getTimezoneString(tz)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {targetTimezone && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{getTimezoneString(targetTimezone)}</p>
              </div>
            )}
          </div>

          {/* Time Display */}
          {sourceTimezone && targetTimezone && selectedDate && (
            <div className="md:col-span-2 mt-6 p-6 bg-gray-50 rounded-xl">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    {sourceTimezone.label}
                  </h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {new Date(selectedDate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    {targetTimezone.label}
                  </h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {convertedTime?.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

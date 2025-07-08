import React, { useState, useEffect, useMemo } from 'react';
import * as ct from 'countries-and-timezones';

export default function TimeZoneConverter() {
  // Get all countries from the library
  const allCountries = useMemo(() => Object.values(ct.getAllCountries()), []);

  // Country and timezone selection state
  const [fromCountry, setFromCountry] = useState(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const found = allCountries.find((c: any) => c.timezones.includes(tz));
    return found ? found.name : '';
  });
  const [fromZone, setFromZone] = useState(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz;
  });
  const [toCountry, setToCountry] = useState('');
  const [toZone, setToZone] = useState('');
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [convertedTime, setConvertedTime] = useState<string>('');
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');

  useEffect(() => {
    convertTime();
  }, [fromZone, toZone, selectedTime]);

  const convertTime = () => {
    if (!toZone) return;
    try {
      const time = selectedTime.toLocaleString('en-US', {
        timeZone: toZone,
        dateStyle: 'full',
        timeStyle: 'long'
      });
      setConvertedTime(time);
    } catch (error) {
      console.error('Error converting time:', error);
    }
  };

  // Country autocomplete
  const filteredFromCountries = allCountries.filter((c: any) =>
    c.name.toLowerCase().includes(fromSearch.toLowerCase())
  );
  const filteredToCountries = allCountries.filter((c: any) =>
    c.name.toLowerCase().includes(toSearch.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Country Time Zone Converter</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {/* From Country Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From Country</label>
          <div className="relative mb-2">
            <input
              type="text"
              value={fromSearch || fromCountry}
              onChange={e => {
                setFromSearch(e.target.value);
                setFromCountry(e.target.value);
              }}
              placeholder="Search countries..."
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              onFocus={() => setFromSearch('')}
            />
            {fromSearch && (
              <div className="absolute left-0 right-0 max-h-40 overflow-y-auto border rounded-lg bg-white z-10">
                {filteredFromCountries.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setFromCountry(c.name);
                      setFromZone(c.timezones[0]);
                      setFromSearch('');
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${fromCountry === c.name ? 'bg-blue-50 text-blue-600' : ''}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* If country has multiple time zones, let user pick */}
          {fromCountry && (allCountries.find((c: any) => c.name === fromCountry)?.timezones.length > 1) && (
            <select
              value={fromZone}
              onChange={e => setFromZone(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
            >
              {allCountries.find((c: any) => c.name === fromCountry)?.timezones.map((tz: string) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
            <input
              type="datetime-local"
              value={selectedTime.toISOString().slice(0, 16)}
              onChange={e => setSelectedTime(new Date(e.target.value))}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {/* To Country Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To Country</label>
          <div className="relative mb-2">
            <input
              type="text"
              value={toSearch || toCountry}
              onChange={e => {
                setToSearch(e.target.value);
                setToCountry(e.target.value);
              }}
              placeholder="Search countries..."
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              onFocus={() => setToSearch('')}
            />
            {toSearch && (
              <div className="absolute left-0 right-0 max-h-40 overflow-y-auto border rounded-lg bg-white z-10">
                {filteredToCountries.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setToCountry(c.name);
                      setToZone(c.timezones[0]);
                      setToSearch('');
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${toCountry === c.name ? 'bg-blue-50 text-blue-600' : ''}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* If country has multiple time zones, let user pick */}
          {toCountry && (allCountries.find((c: any) => c.name === toCountry)?.timezones.length > 1) && (
            <select
              value={toZone}
              onChange={e => setToZone(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
            >
              {allCountries.find((c: any) => c.name === toCountry)?.timezones.map((tz: string) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      {/* Converted Time Display */}
      {convertedTime && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Converted Time</h3>
          <p className="text-gray-600">{convertedTime}</p>
        </div>
      )}
    </div>
  );
}

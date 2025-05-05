import { useState, useEffect } from 'react';

const TIME_ZONES = Intl.supportedValuesOf('timeZone');

export default function TimeZoneConverter() {
  const [fromZone, setFromZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [toZone, setToZone] = useState('');
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [convertedTime, setConvertedTime] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredTimeZones = TIME_ZONES.filter(zone => 
    zone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Time Zone Converter</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* From Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From Time Zone</label>
          <select
            value={fromZone}
            onChange={(e) => setFromZone(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {TIME_ZONES.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
            <input
              type="datetime-local"
              value={selectedTime.toISOString().slice(0, 16)}
              onChange={(e) => setSelectedTime(new Date(e.target.value))}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* To Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To Time Zone</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search time zones..."
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <div className="max-h-40 overflow-y-auto border rounded-lg">
              {filteredTimeZones.map(zone => (
                <button
                  key={zone}
                  onClick={() => {
                    setToZone(zone);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                    toZone === zone ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>
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

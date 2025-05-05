export interface Timezone {
  value: string;
  label: string;
  offset: number;
  abbr: string;
  utc?: string[];
  country?: string;
}

// Function to get current browser timezone
export const getBrowserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Function to format timezone offset
export const formatOffset = (offset: number): string => {
  const hours = Math.floor(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) - hours) * 60);
  return `${offset >= 0 ? '+' : '-'}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const fetchTimezones = async (): Promise<Timezone[]> => {
  try {
    // Get IANA timezone list
    const timeZones = Intl.supportedValuesOf('timeZone');
    const now = new Date();

    return timeZones.map(zoneId => {
      try {
        const formatter = new Intl.DateTimeFormat('en', {
          timeZone: zoneId,
          timeZoneName: 'shortOffset'
        });

        const parts = formatter.formatToParts(now);
        const abbr = parts.find(p => p.type === 'timeZoneName')?.value || '';
        
        // Calculate offset
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: zoneId }));
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const offset = (tzDate.getTime() - utcDate.getTime()) / (3600000); // Convert to hours

        // Format location name
        const [region, ...cityParts] = zoneId.split('/');
        const city = cityParts.join('/').replace(/_/g, ' ');
        
        return {
          value: zoneId,
          label: city ? `${city}, ${region}` : region,
          offset,
          abbr,
          country: region,
          utc: [`UTC${formatOffset(offset)}`]
        };
      } catch {
        // Return a basic entry if parsing fails
        return {
          value: zoneId,
          label: zoneId.replace(/_/g, ' '),
          offset: 0,
          abbr: zoneId,
          country: zoneId.split('/')[0],
          utc: ['UTC+00:00']
        };
      }
    }).sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    console.error('Error creating timezone list:', error);
    // Return UTC only as fallback
    return [{
      value: 'UTC',
      label: 'UTC (Coordinated Universal Time)',
      offset: 0,
      abbr: 'UTC',
      utc: ['UTC']
    }];
  }
};

// Function to get formatted timezone string
export const getTimezoneString = (tz: Timezone): string => {
  return `${tz.label} (${tz.abbr}, UTC${formatOffset(tz.offset)})`;
};

// Function to convert time between timezones
export const convertTime = (
  date: Date,
  fromTimezone: Timezone,
  toTimezone: Timezone
): Date => {
  try {
    // Convert to string in source timezone
    const sourceDate = new Date(date).toLocaleString('en-US', {
      timeZone: fromTimezone.value
    });

    // Create date object in source timezone
    const utcDate = new Date(sourceDate);

    // Convert to target timezone
    return new Date(utcDate.toLocaleString('en-US', {
      timeZone: toTimezone.value
    }));
  } catch (error) {
    console.error('Time conversion error:', error);
    return date; // Return original date if conversion fails
  }
};

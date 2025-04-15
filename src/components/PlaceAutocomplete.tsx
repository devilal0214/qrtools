import { useEffect, useRef, useState } from 'react';

interface PlaceAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  className?: string;
}

export function PlaceAutocomplete({ value, onChange, className }: PlaceAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.onload = initAutocomplete;
      document.head.appendChild(script);
      setLoaded(true);
    }
  }, [loaded]);

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        onChange(place.formatted_address);
      }
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      placeholder="Enter location"
    />
  );
}

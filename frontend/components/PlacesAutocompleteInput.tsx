"use client";

import { useEffect, useRef } from "react";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function loadGoogleMapsPlaces(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps?.places?.Autocomplete) { resolve(); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface PlacesAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceDetails?: (details: { region?: string; commune?: string; city?: string }) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Bias results to Chile by default */
  country?: string;
}

export default function PlacesAutocompleteInput({
  value,
  onChange,
  onPlaceDetails,
  placeholder = "Busca una dirección...",
  className,
  style,
  country = "cl",
}: PlacesAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceDetailsRef = useRef(onPlaceDetails);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onPlaceDetailsRef.current = onPlaceDetails; }, [onPlaceDetails]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const google = (window as any).google;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["geocode", "establishment"],
          componentRestrictions: { country },
          fields: ["formatted_address", "geometry", "name", "address_components"],
        });
        autocompleteRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const address = place.formatted_address || place.name || inputRef.current?.value || "";
          onChangeRef.current(address);
          // Extract region and commune from address_components
          if (onPlaceDetailsRef.current) {
            const comps = (place.address_components || []) as Array<{ long_name: string; types: string[] }>;
            if (comps.length > 0) {
              const region = comps.find(c => c.types.includes("administrative_area_level_1"))?.long_name;
              const commune =
                comps.find(c => c.types.includes("locality"))?.long_name ||
                comps.find(c => c.types.includes("administrative_area_level_3"))?.long_name ||
                comps.find(c => c.types.includes("sublocality_level_1"))?.long_name ||
                comps.find(c => c.types.includes("sublocality"))?.long_name;
              const city = comps.find(c => c.types.includes("administrative_area_level_2"))?.long_name;
              onPlaceDetailsRef.current({ region, commune: commune || city, city });
            }
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (autocompleteRef.current) {
        (window as any).google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className={className}
      style={style}
      placeholder={placeholder}
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

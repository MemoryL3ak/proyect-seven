"use client";

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };

interface TripMapProps {
  origin?: string | null;
  destination?: string | null;
  driverPosition?: LatLng | null;
  userPosition?: LatLng | null;
  height?: number;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function createUserIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <defs><filter id="su" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/></filter></defs>
    <circle cx="22" cy="22" r="20" fill="#2563eb" stroke="#fff" stroke-width="3" filter="url(#su)"/>
    <circle cx="22" cy="16" r="5" fill="#fff"/>
    <path d="M13 31 C13 25 17 22 22 22 C27 22 31 25 31 31" fill="#fff"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createCarIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/></filter></defs>
    <circle cx="28" cy="28" r="26" fill="#062240" stroke="#21D0B3" stroke-width="3" filter="url(#s)"/>
    <g transform="translate(14,16)">
      <rect x="2" y="8" width="24" height="11" rx="3" fill="#21D0B3"/>
      <path d="M5 8 L8 2 L20 2 L23 8" fill="#34F3C6" stroke="#062240" stroke-width="0.5"/>
      <rect x="9" y="3" width="2" height="5" rx="0.5" fill="#062240" opacity="0.3"/>
      <rect x="17" y="3" width="2" height="5" rx="0.5" fill="#062240" opacity="0.3"/>
      <circle cx="7" cy="19" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.5"/>
      <circle cx="21" cy="19" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.5"/>
      <rect x="0" y="11" width="4" height="2" rx="1" fill="#FFD700"/>
      <rect x="24" y="11" width="4" height="2" rx="1" fill="#FF4444"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps?.Map) { resolve(); return; }
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

export default function TripMap({ origin, destination, driverPosition, userPosition, height = 260 }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const initKey = useRef("");
  const driverPositionRef = useRef<LatLng | null>(driverPosition ?? null);

  // Keep ref in sync so the async init always reads the latest value
  useEffect(() => {
    driverPositionRef.current = driverPosition ?? null;
  }, [driverPosition]);

  // Init / reinit map when origin/destination change
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    const key = `${origin ?? ""}|${destination ?? ""}`;
    if (initKey.current === key && mapRef.current) return;
    initKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        return;
      }
      if (cancelled || !containerRef.current) return;

      const google = (window as any).google;
      const defaultCenter = { lat: -33.45, lng: -70.65 };

      // Create or reuse map
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: defaultCenter,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });
      }

      // Remove old renderer
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }

      if (cancelled) return;

      const map = mapRef.current;

      if (origin && destination) {
        const directionsService = new google.maps.DirectionsService();
        const renderer = new google.maps.DirectionsRenderer({
          suppressMarkers: false,
          polylineOptions: { strokeColor: "#21D0B3", strokeWeight: 4 },
        });
        renderer.setMap(map);
        directionsRendererRef.current = renderer;

        directionsService.route(
          {
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: string) => {
            if (cancelled) return;
            if (status === "OK") {
              renderer.setDirections(result);
            } else {
              // Fallback: geocode and center
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: origin }, (results: any, st: string) => {
                if (cancelled || st !== "OK" || !results?.[0]) return;
                map.setCenter(results[0].geometry.location);
                map.setZoom(13);
                new google.maps.Marker({ position: results[0].geometry.location, map, label: "A" });
              });
            }
          }
        );
      } else if (origin || destination) {
        const addr = origin || destination;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: addr }, (results: any, status: string) => {
          if (cancelled || status !== "OK" || !results?.[0]) return;
          map.setCenter(results[0].geometry.location);
          map.setZoom(14);
          new google.maps.Marker({ position: results[0].geometry.location, map });
        });
      }

      // Driver marker — read from ref so we get the latest position even if
      // it arrived while Google Maps was still loading
      const latestDriverPos = driverPositionRef.current;
      if (latestDriverPos) {
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setPosition(latestDriverPos);
        } else {
          driverMarkerRef.current = new google.maps.Marker({
            position: latestDriverPos,
            map,
            icon: {
              url: createCarIconUrl(),
              scaledSize: new google.maps.Size(56, 56),
              anchor: new google.maps.Point(28, 28),
            },
            title: "Conductor",
            zIndex: 10,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, destination]);

  // Update driver marker position when it changes
  useEffect(() => {
    if (!mapRef.current || !driverPosition) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(driverPosition);
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: driverPosition,
        map: mapRef.current,
        icon: {
          url: createCarIconUrl(),
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28),
        },
        title: "Conductor",
        zIndex: 10,
      });
    }
  }, [driverPosition]);

  // Update user marker position
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(userPosition);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position: userPosition,
        map: mapRef.current,
        icon: {
          url: createUserIconUrl(),
          scaledSize: new google.maps.Size(44, 44),
          anchor: new google.maps.Point(22, 22),
        },
        title: "Tu ubicación",
        zIndex: 9,
      });
    }
  }, [userPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      mapRef.current = null;
      initKey.current = "";
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", background: "#e5e3df" }}
    />
  );
}

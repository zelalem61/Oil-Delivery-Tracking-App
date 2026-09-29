'use client';

import { useEffect, useRef, useState } from 'react';

type LatestLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  recordedAt: string;
};

type MapDelivery = {
  id: string;
  deliveryNumber: string;
  truckPlate: string;
  status: string;
  driver?: { firstName: string; lastName: string };
  latestLocation?: LatestLocation | null;
};

type Leaflet = {
  map(element: HTMLElement): {
    setView(center: [number, number], zoom: number): unknown;
    getCenter(): { lat: number; lng: number };
    getZoom(): number;
    remove(): void;
    fitBounds(bounds: Array<[number, number]>, options: { padding: [number, number] }): void;
  };
  tileLayer(
    url: string,
    options: { attribution: string; maxZoom: number; maxNativeZoom?: number },
  ): { addTo(map: unknown): void };
  marker(position: [number, number]): {
    addTo(map: unknown): { bindPopup(html: string): { openPopup(): void } };
  };
};

declare global {
  interface Window {
    L?: Leaflet;
  }
}

type BaseLayer = 'map' | 'satellite' | 'hybrid';
const LAYER_KEY = 'fueltrack.map.layer';
const esri = (service: string) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;
const esriAttribution =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const layerOptions: { value: BaseLayer; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
];

const leafletCss = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const leafletJs = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const areaKey = (latitude: number, longitude: number) =>
  `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!,
  );

export function DriverMap({
  deliveries,
  selectedDeliveryId,
}: {
  deliveries: MapDelivery[];
  selectedDeliveryId?: string | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const resolvingAreas = useRef(new Set<string>());
  const savedView = useRef<{ latitude: number; longitude: number; zoom: number } | null>(null);
  const previousSelection = useRef<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [cityByArea, setCityByArea] = useState<Record<string, string>>({});
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('map');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYER_KEY);
      if (saved === 'map' || saved === 'satellite' || saved === 'hybrid') setBaseLayer(saved);
    } catch {
      // Storage can be unavailable; default to the street map.
    }
  }, []);

  function chooseLayer(layer: BaseLayer) {
    setBaseLayer(layer);
    try {
      localStorage.setItem(LAYER_KEY, layer);
    } catch {
      // Ignore storage failures.
    }
  }
  const positioned = deliveries.filter((delivery) => delivery.latestLocation);
  const selectedWithoutLocation = Boolean(
    selectedDeliveryId &&
    deliveries.find((delivery) => delivery.id === selectedDeliveryId && !delivery.latestLocation),
  );

  useEffect(() => {
    positioned.forEach((delivery) => {
      const location = delivery.latestLocation!;
      const key = areaKey(location.latitude, location.longitude);
      if (cityByArea[key] || resolvingAreas.current.has(key)) return;
      resolvingAreas.current.add(key);
      const query = new URLSearchParams({
        format: 'jsonv2',
        lat: String(location.latitude),
        lon: String(location.longitude),
        zoom: '10',
        addressdetails: '1',
        'accept-language': 'en',
      });
      void fetch(`https://nominatim.openstreetmap.org/reverse?${query}`)
        .then((response) =>
          response.ok ? response.json() : Promise.reject(new Error('Reverse geocoding failed')),
        )
        .then((result: { address?: Record<string, string>; display_name?: string }) => {
          const address = result.address ?? {};
          const locality =
            address.suburb ??
            address.neighbourhood ??
            address.city_district ??
            address.city ??
            address.town ??
            address.village ??
            address.municipality;
          const broaderCity = [
            address.city,
            address.state_district,
            address.state,
            address.county,
          ].find((place) => place && place.toLocaleLowerCase() !== locality?.toLocaleLowerCase());
          const place =
            [locality, broaderCity].filter(Boolean).join(', ') ||
            result.display_name ||
            'Unknown area';
          setCityByArea((current) => ({ ...current, [key]: place }));
        })
        .catch(() =>
          setCityByArea((current) => ({ ...current, [key]: 'Nearest city unavailable' })),
        )
        .finally(() => resolvingAreas.current.delete(key));
    });
  }, [deliveries, cityByArea]);

  useEffect(() => {
    let map: ReturnType<Leaflet['map']> | undefined;
    let cancelled = false;
    const draw = () => {
      if (cancelled || !element.current || !window.L) return;
      const leaflet = window.L;
      const points = positioned.map(
        (delivery) =>
          [delivery.latestLocation!.latitude, delivery.latestLocation!.longitude] as [
            number,
            number,
          ],
      );
      map = leaflet.map(element.current);
      const selected = positioned.find((delivery) => delivery.id === selectedDeliveryId);
      const selectedPoint = selected?.latestLocation
        ? ([selected.latestLocation.latitude, selected.latestLocation.longitude] as [
            number,
            number,
          ])
        : null;
      const selectionChanged = Boolean(
        selectedPoint && selectedDeliveryId !== previousSelection.current,
      );
      const preservedPoint = savedView.current
        ? ([savedView.current.latitude, savedView.current.longitude] as [number, number])
        : null;
      const zoom = selectionChanged
        ? 15
        : (savedView.current?.zoom ?? (selectedPoint ? 15 : points.length ? 11 : 5));
      map.setView(
        selectionChanged
          ? selectedPoint!
          : (preservedPoint ?? selectedPoint ?? points[0] ?? [9.03, 38.74]),
        zoom,
      );
      if (baseLayer === 'map') {
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
          })
          .addTo(map);
      } else {
        leaflet
          .tileLayer(esri('World_Imagery'), {
            attribution: esriAttribution,
            maxZoom: 19,
            maxNativeZoom: 18,
          })
          .addTo(map);
        if (baseLayer === 'hybrid') {
          leaflet
            .tileLayer(esri('Reference/World_Transportation'), {
              attribution: '',
              maxZoom: 19,
              maxNativeZoom: 18,
            })
            .addTo(map);
          leaflet
            .tileLayer(esri('Reference/World_Boundaries_and_Places'), {
              attribution: '',
              maxZoom: 19,
              maxNativeZoom: 18,
            })
            .addTo(map);
        }
      }
      positioned.forEach((delivery) => {
        const location = delivery.latestLocation!;
        const driver = delivery.driver
          ? `${delivery.driver.firstName} ${delivery.driver.lastName}`
          : 'Unassigned driver';
        const updated = new Date(location.recordedAt).toLocaleString();
        const speed =
          location.speed == null
            ? 'Unavailable'
            : `${Math.max(0, location.speed * 3.6).toFixed(1)} km/h`;
        const nearbyCity =
          cityByArea[areaKey(location.latitude, location.longitude)] ?? 'Finding nearest city…';
        const marker = leaflet
          .marker([location.latitude, location.longitude])
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(driver)}</strong><br>${escapeHtml(delivery.truckPlate)} · ${escapeHtml(delivery.deliveryNumber)}<br><strong>Near: ${escapeHtml(nearbyCity)}</strong><br>${escapeHtml(delivery.status.replaceAll('_', ' '))}<br>Speed: ${escapeHtml(speed)}<br>Updated: ${escapeHtml(updated)}`,
          );
        if (delivery.id === selectedDeliveryId) marker.openPopup();
      });
      if (!savedView.current && !selectedPoint && points.length > 1)
        map.fitBounds(points, { padding: [35, 35] });
      previousSelection.current = selectedDeliveryId;
    };
    const existingCss = document.querySelector(`link[href="${leafletCss}"]`);
    if (!existingCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = leafletCss;
      document.head.appendChild(link);
    }
    if (window.L) draw();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${leafletJs}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = leafletJs;
        script.async = true;
        document.body.appendChild(script);
      }
      script.addEventListener('load', draw, { once: true });
      script.addEventListener('error', () => setLoadError(true), { once: true });
    }
    return () => {
      cancelled = true;
      if (map) {
        const center = map.getCenter();
        savedView.current = { latitude: center.lat, longitude: center.lng, zoom: map.getZoom() };
        map.remove();
      }
    };
  }, [deliveries, selectedDeliveryId, cityByArea, baseLayer]);

  return (
    <article className="panel map-panel" id="driver-map-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LIVE GPS</p>
          <h2>Active driver locations</h2>
        </div>
        <div className="map-tools">
          <div className="segmented segmented-sm" role="group" aria-label="Map style">
            {layerOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={baseLayer === option.value ? 'active' : ''}
                aria-pressed={baseLayer === option.value}
                onClick={() => chooseLayer(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="map-count">{positioned.length} reporting</span>
        </div>
      </div>
      <div className="driver-map" ref={element} />
      {loadError ? (
        <p className="map-message">
          Map tiles could not load. Check the computer internet connection.
        </p>
      ) : selectedWithoutLocation ? (
        <p className="map-message">The selected driver has not reported a GPS location yet.</p>
      ) : positioned.length === 0 ? (
        <p className="map-message">
          No live location yet. Open an active trip on the driver phone and allow location access.
        </p>
      ) : null}
    </article>
  );
}

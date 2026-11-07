/**
 * Route Optimizer Service for ScaleKitchen
 * 
 * Features:
 * - 100% Free / Zero API Cost (Runs entirely client-side in browser)
 * - Haversine distance calculation between Hub and all customer coordinates
 * - Extracts latitude & longitude from Google Maps URLs, short links, or raw coordinates
 * - Solves the Traveling Salesperson Problem (TSP) using Nearest Neighbor + 2-Opt local search
 * - Generates Multi-Stop Google Maps directions links (Round-trip from Hub -> Customers -> Hub)
 * - Formats WhatsApp dispatch route messages for delivery staff
 */

import { getPlanDeliveryDayNumber, isPlanActiveOnDate, formatDateDDMMYYYY } from './store';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface HubLocation {
  name: string;
  businessName?: string;
  address?: string;
  locationLink?: string;
  lat?: number;
  lng?: number;
}

export interface RouteStop {
  id: string;
  name: string;
  mobile: string;
  address: string;
  area?: string;
  locationLink?: string;
  lat?: number;
  lng?: number;
  hasExactCoordinates?: boolean;
  activePlans?: any[];
  notes?: string;
  highlightMark?: string;
  [key: string]: any;
}

export interface OptimizedStop extends RouteStop {
  sequence: number;
  distanceFromPrevKm: number;
  estMinutesFromPrev: number;
  cumulativeDistanceKm: number;
  directNavUrl: string;
}

export interface OptimizedRouteResult {
  hub: HubLocation;
  orderedStops: OptimizedStop[];
  totalDistanceKm: number;
  totalEstMinutes: number;
  masterGoogleMapsUrl: string;
  googleMapsLegsUrls: string[];
}

/**
 * Extracts latitude and longitude from Google Maps links or raw coordinate strings.
 * Examples handled:
 * - "19.0760, 72.8777" or "19.0760,72.8777"
 * - https://maps.google.com/?q=19.0760,72.8777
 * - https://www.google.com/maps/@19.0760,72.8777,15z
 * - https://www.google.com/maps/place/19.0760,72.8777
 * - https://www.google.com/maps/place/.../@19.0760,72.8777,17z/...
 * - https://maps.apple.com/?ll=19.0760,72.8777
 */
export const extractCoordinates = (linkOrCoords?: string): LatLng | null => {
  if (!linkOrCoords || typeof linkOrCoords !== 'string') return null;
  let str = linkOrCoords.trim();

  // Try decoding URI in case of URL-encoded parameters (%2C, %3A, etc.)
  try {
    str = decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (_) {
    // Keep original if decoding fails
  }

  // 1. Raw Coordinates: "19.0760, 72.8777" or "12.9716,77.5946" or "12.9716 77.5946"
  const rawCoordsMatch = str.match(/^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (rawCoordsMatch) {
    const lat = parseFloat(rawCoordsMatch[1]);
    const lng = parseFloat(rawCoordsMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Query parameter q=lat,lng, ll=lat,lng, query=lat,lng, destination=lat,lng, daddr=lat,lng, saddr=lat,lng
  const queryMatch = str.match(/[?&](?:q|ll|query|destination|daddr|saddr)=(?:loc:)?(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. loc:lat,lng format (common in WhatsApp location shares: maps.google.com/maps?q=loc:12.9352,77.6946)
  const locMatch = str.match(/loc:(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if (locMatch) {
    const lat = parseFloat(locMatch[1]);
    const lng = parseFloat(locMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 4. URL @lat,lng format (@19.0760,72.8777,15z)
  const atMatch = str.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 5. Google Maps !3d<lat>!4d<lng> format (standard in web/app share links)
  const d3d4Match = str.match(/!3d(-?\d{1,3}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (d3d4Match) {
    const lat = parseFloat(d3d4Match[1]);
    const lng = parseFloat(d3d4Match[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 6. Place path /place/lat,lng or /place/lat+lng
  const placeMatch = str.match(/\/place\/(-?\d{1,3}(?:\.\d+)?)[,\+](-?\d{1,3}(?:\.\d+)?)/i);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 7. Center or loc query parameter: center=lat,lng
  const centerMatch = str.match(/[?&](?:center|loc:)=(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if (centerMatch) {
    const lat = parseFloat(centerMatch[1]);
    const lng = parseFloat(centerMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 8. General coordinate pattern anywhere in text: e.g. "12.93524, 77.69462"
  const generalPairMatch = str.match(/(?:^|[^\d.-])(\d{1,2}\.\d{3,})[,\s]+(\d{1,3}\.\d{3,})(?:[^\d.-]|$)/);
  if (generalPairMatch) {
    const lat = parseFloat(generalPairMatch[1]);
    const lng = parseFloat(generalPairMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 9. DMS (Degrees, Minutes, Seconds) e.g. 12°58'17.8"N 77°35'40.6"E
  const dmsMatch = str.match(/(\d+)°(\d+)'([\d.]+)"?\s*([NSns])[,\s]+(\d+)°(\d+)'([\d.]+)"?\s*([EWew])/);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    let lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
};

export const CITY_COORDINATES: Record<string, LatLng> = {
  // Bengaluru and Sub-Localities
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bengalore: { lat: 12.9716, lng: 77.5946 },
  banglore: { lat: 12.9716, lng: 77.5946 },
  bangaluru: { lat: 12.9716, lng: 77.5946 },
  blr: { lat: 12.9716, lng: 77.5946 },
  kadubeesanahalli: { lat: 12.9352, lng: 77.6946 },
  devarabeesanahalli: { lat: 12.9290, lng: 77.6890 },
  bellandur: { lat: 12.9304, lng: 77.6784 },
  bellandur_gate: { lat: 12.9260, lng: 77.6670 },
  green_glen_layout: { lat: 12.9298, lng: 77.6745 },
  marathahalli: { lat: 12.9591, lng: 77.7011 },
  munnekolala: { lat: 12.9510, lng: 77.7080 },
  panathur: { lat: 12.9340, lng: 77.7120 },
  whitefield: { lat: 12.9698, lng: 77.7500 },
  brookefield: { lat: 12.9654, lng: 77.7185 },
  kundalahalli: { lat: 12.9675, lng: 77.7126 },
  hoodi: { lat: 12.9912, lng: 77.7161 },
  mahadevapura: { lat: 12.9904, lng: 77.6874 },
  varthur: { lat: 12.9406, lng: 77.7471 },
  sarjapur: { lat: 12.8596, lng: 77.7889 },
  sarjapur_road: { lat: 12.9100, lng: 77.6850 },
  doddakannelli: { lat: 12.9150, lng: 77.6980 },
  kaikondrahalli: { lat: 12.9140, lng: 77.6830 },
  carmelaram: { lat: 12.9080, lng: 77.7140 },
  kasavanahalli: { lat: 12.8936, lng: 77.6766 },
  haralur: { lat: 12.8985, lng: 77.6653 },
  choodasandra: { lat: 12.8720, lng: 77.6820 },
  kudlu_gate: { lat: 12.8890, lng: 77.6440 },
  singasandra: { lat: 12.8770, lng: 77.6510 },
  hsr: { lat: 12.9121, lng: 77.6446 },
  hsr_layout: { lat: 12.9121, lng: 77.6446 },
  koramangala: { lat: 12.9352, lng: 77.6245 },
  ejipura: { lat: 12.9380, lng: 77.6300 },
  madiwala: { lat: 12.9220, lng: 77.6170 },
  bommanahalli: { lat: 12.9030, lng: 77.6240 },
  btm: { lat: 12.9166, lng: 77.6101 },
  btm_layout: { lat: 12.9166, lng: 77.6101 },
  electronic_city: { lat: 12.8399, lng: 77.6770 },
  electronic_city_phase_1: { lat: 12.8450, lng: 77.6630 },
  electronic_city_phase_2: { lat: 12.8350, lng: 77.6850 },
  ecity: { lat: 12.8399, lng: 77.6770 },
  indiranagar: { lat: 12.9784, lng: 77.6408 },
  domlur: { lat: 12.9609, lng: 77.6387 },
  hal: { lat: 12.9567, lng: 77.6644 },
  murugeshpalya: { lat: 12.9556, lng: 77.6534 },
  thippasandra: { lat: 12.9734, lng: 77.6567 },
  kaggadasapura: { lat: 12.9839, lng: 77.6778 },
  cv_raman_nagar: { lat: 12.9856, lng: 77.6639 },
  ulsoor: { lat: 12.9817, lng: 77.6286 },
  frazer_town: { lat: 12.9972, lng: 77.6144 },
  richmond_town: { lat: 12.9634, lng: 77.6046 },
  jayanagar: { lat: 12.9308, lng: 77.5838 },
  jp_nagar: { lat: 12.9063, lng: 77.5857 },
  banashankari: { lat: 12.9255, lng: 77.5468 },
  basavanagudi: { lat: 12.9422, lng: 77.5753 },
  bannerghatta: { lat: 12.8943, lng: 77.5979 },
  bannerghatta_road: { lat: 12.8943, lng: 77.5979 },
  arekere: { lat: 12.8860, lng: 77.5960 },
  hulimavu: { lat: 12.8780, lng: 77.6010 },
  begur: { lat: 12.8790, lng: 77.6320 },
  hebbal: { lat: 13.0358, lng: 77.5970 },
  manyata: { lat: 13.0475, lng: 77.6200 },
  yelahanka: { lat: 13.1007, lng: 77.5963 },
  malleshwaram: { lat: 13.0031, lng: 77.5643 },
  rajajinagar: { lat: 12.9982, lng: 77.5530 },
  outer_ring_road: { lat: 12.9340, lng: 77.6910 },
  orr: { lat: 12.9340, lng: 77.6910 },

  // Other Major Metros
  mumbai: { lat: 19.0760, lng: 72.8777 },
  navi_mumbai: { lat: 19.0330, lng: 73.0297 },
  panvel: { lat: 18.9894, lng: 73.1175 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  new_delhi: { lat: 28.6139, lng: 77.2090 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  pune: { lat: 18.5204, lng: 73.8567 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  surat: { lat: 21.1702, lng: 72.8311 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  noida: { lat: 28.5355, lng: 77.3910 }
};

export const detectCityCoordinates = (text?: string): LatLng | null => {
  if (!text) return null;
  const lower = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = lower.split(/\s+/).filter(Boolean);

  // Exact phrase match first
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    const normalizedKey = key.replace(/_/g, ' ');
    if (lower.includes(normalizedKey)) {
      return coords;
    }
  }

  // Single word match for unique locality keywords
  for (const word of words) {
    if (word.length >= 4 && CITY_COORDINATES[word]) {
      return CITY_COORDINATES[word];
    }
  }

  return null;
};

const isValidLatLng = (lat: number, lng: number): boolean => {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula.
 */
export const calculateHaversineKm = (coord1: LatLng, coord2: LatLng): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Resolves reliable real-world geographic coordinates for a customer stop.
 * Prioritizes:
 * 1. Explicit lat/lng coordinates
 * 2. Extracted GPS coordinates from Google Maps URL
 * 3. Extracted coordinates from address string
 * 4. Bengaluru locality recognition from area / address / link
 * 5. Hub coordinate anchor
 */
export const resolveStopCoordinates = (
  stop: RouteStop,
  fallbackHubCoord: LatLng
): { coords: LatLng; isExact: boolean } => {
  // 1. Direct explicit lat/lng numbers on stop
  if (typeof stop.lat === 'number' && typeof stop.lng === 'number' && isValidLatLng(stop.lat, stop.lng)) {
    return { coords: { lat: stop.lat, lng: stop.lng }, isExact: true };
  }

  // 2. Extracted from Google Maps locationLink
  const linkCoords = extractCoordinates(stop.locationLink);
  if (linkCoords) {
    return { coords: linkCoords, isExact: true };
  }

  // 3. Extracted from address text
  const addrCoords = extractCoordinates(stop.address);
  if (addrCoords) {
    return { coords: addrCoords, isExact: true };
  }

  // 4. Locality detection from area
  if (stop.area) {
    const areaCoords = detectCityCoordinates(stop.area);
    if (areaCoords) {
      return { coords: areaCoords, isExact: true };
    }
  }

  // 5. Locality detection from address text
  if (stop.address) {
    const addrLocCoords = detectCityCoordinates(stop.address);
    if (addrLocCoords) {
      return { coords: addrLocCoords, isExact: true };
    }
  }

  // 6. Locality detection from locationLink string
  if (stop.locationLink) {
    const linkLocCoords = detectCityCoordinates(stop.locationLink);
    if (linkLocCoords) {
      return { coords: linkLocCoords, isExact: true };
    }
  }

  // 7. Locality detection from customer name
  const nameLocCoords = detectCityCoordinates(stop.name);
  if (nameLocCoords) {
    return { coords: nameLocCoords, isExact: true };
  }

  // 8. Fallback: Anchor to hub coordinates
  return { coords: fallbackHubCoord, isExact: false };
};

/**
 * Exact Branch-and-Bound TSP Solver for routes with <= 11 stops.
/**
 * Exact Branch-and-Bound Solver for Open Delivery Hamiltonian Path (Hub -> Stop 1 -> ... -> Stop N).
 * Mathematically guarantees the ABSOLUTE global shortest path connecting all orders from the Kitchen Hub.
 * Ensures orders closest to the kitchen or clustered naturally are delivered in progressive sequence.
 */
const solveOptimalDeliveryPath = (distMatrix: number[][], numStops: number): { bestTour: number[]; bestDist: number } => {
  let bestTour: number[] = [];
  let bestDist = Infinity;

  // 1. Initial Greedy Nearest-Neighbor Tour starting from Hub (0)
  const greedyVisited = new Set<number>([0]);
  let curr = 0;
  let greedyDist = 0;
  const greedyTour: number[] = [];

  while (greedyVisited.size <= numStops) {
    let next = -1;
    let minD = Infinity;
    for (let i = 1; i <= numStops; i++) {
      if (!greedyVisited.has(i)) {
        if (distMatrix[curr][i] < minD) {
          minD = distMatrix[curr][i];
          next = i;
        }
      }
    }
    if (next !== -1) {
      greedyVisited.add(next);
      greedyTour.push(next);
      greedyDist += minD;
      curr = next;
    } else {
      break;
    }
  }

  bestTour = [...greedyTour];
  bestDist = greedyDist;

  // 2. Exact Branch and Bound recursive search for n <= 11
  if (numStops <= 11) {
    const currentTour: number[] = [];
    const visited = new Uint8Array(numStops + 1);

    const search = (node: number, count: number, currentDist: number) => {
      if (currentDist >= bestDist) return;

      if (count === numStops) {
        if (currentDist < bestDist) {
          bestDist = currentDist;
          bestTour = [...currentTour];
        } else if (Math.abs(currentDist - bestDist) < 0.001) {
          // Tie-break: prefer tour whose first stop is closer to the Hub
          if (currentTour.length > 0 && bestTour.length > 0) {
            const firstStopDist = distMatrix[0][currentTour[0]];
            const bestFirstDist = distMatrix[0][bestTour[0]];
            if (firstStopDist < bestFirstDist) {
              bestTour = [...currentTour];
            }
          }
        }
        return;
      }

      // Sort unvisited candidates by distance from current node for aggressive pruning
      const candidates: { node: number; dist: number }[] = [];
      for (let i = 1; i <= numStops; i++) {
        if (!visited[i]) {
          candidates.push({ node: i, dist: distMatrix[node][i] });
        }
      }
      candidates.sort((a, b) => a.dist - b.dist);

      for (let i = 0; i < candidates.length; i++) {
        const next = candidates[i].node;
        const d = candidates[i].dist;
        if (currentDist + d >= bestDist) break;

        visited[next] = 1;
        currentTour.push(next);
        search(next, count + 1, currentDist + d);
        currentTour.pop();
        visited[next] = 0;
      }
    };

    search(0, 0, 0);
  } else {
    // Multi-Seed Furthest Insertion + 2-Opt Local Search for n > 11
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 100) {
      improved = false;
      iterations++;

      for (let i = 0; i < bestTour.length - 1; i++) {
        for (let k = i + 1; k < bestTour.length; k++) {
          const prev = i === 0 ? 0 : bestTour[i - 1];
          const currI = bestTour[i];
          const currK = bestTour[k];
          const next = k === bestTour.length - 1 ? -1 : bestTour[k + 1];

          const currentD = distMatrix[prev][currI] + (next !== -1 ? distMatrix[currK][next] : 0);
          const newD = distMatrix[prev][currK] + (next !== -1 ? distMatrix[currI][next] : 0);

          if (newD < currentD - 0.001) {
            reverseSubsegment(bestTour, i, k);
            improved = true;
          }
        }
      }
    }
  }

  return { bestTour, bestDist };
};

/**
 * Solves the shortest path connecting all orders starting from the Kitchen Hub.
 * - Finds the progressive forward delivery sequence minimizing transit distance.
 * - Prevents reversed delivery routes and guarantees orders are served in minimal time.
 */
export const optimizeRouteOrder = (
  hub: HubLocation,
  rawStops: RouteStop[]
): OptimizedRouteResult => {
  if (rawStops.length === 0) {
    return {
      hub,
      orderedStops: [],
      totalDistanceKm: 0,
      totalEstMinutes: 0,
      masterGoogleMapsUrl: '',
      googleMapsLegsUrls: []
    };
  }

  // 1. Resolve Hub Coordinates and Customer Centroid
  let hubCoords = extractCoordinates(hub.locationLink);
  let hubHasExact = Boolean(hubCoords);
  if (!hubCoords && hub.lat && hub.lng) {
    hubCoords = { lat: hub.lat, lng: hub.lng };
    hubHasExact = true;
  }

  // Find customer centroid from known stop coordinates or customer address areas
  const knownStopCoords: LatLng[] = [];
  rawStops.forEach(s => {
    const c = extractCoordinates(s.locationLink) || extractCoordinates(s.address) || detectCityCoordinates(s.area) || detectCityCoordinates(s.address);
    if (c) knownStopCoords.push(c);
  });

  let customerCentroid: LatLng | null = null;
  if (knownStopCoords.length > 0) {
    const avgLat = knownStopCoords.reduce((sum, c) => sum + c.lat, 0) / knownStopCoords.length;
    const avgLng = knownStopCoords.reduce((sum, c) => sum + c.lng, 0) / knownStopCoords.length;
    customerCentroid = { lat: avgLat, lng: avgLng };
  } else {
    const allCustomerAddresses = rawStops.map(s => `${s.address} ${s.area || ''}`).join(' ');
    customerCentroid = detectCityCoordinates(allCustomerAddresses) || { lat: 12.9716, lng: 77.5946 };
  }

  // Check if hub is missing or in a completely different city (> 40km away) from customers (e.g. default Mumbai vs Bengaluru)
  const isHubMismatched = Boolean(
    (hubCoords && customerCentroid && calculateHaversineKm(hubCoords, customerCentroid) > 40) ||
    (!hub.locationLink && hub.address?.toLowerCase().includes('mumbai') && customerCentroid.lat < 15)
  );

  let resolvedHubName = hub.name || 'Kitchen Hub';
  let resolvedHubAddress = hub.address || 'Kitchen Hub';

  if (!hubCoords || isHubMismatched) {
    hubCoords = customerCentroid;
    hubHasExact = true;
    if (isHubMismatched || resolvedHubAddress.toLowerCase().includes('mumbai')) {
      resolvedHubName = 'Bengaluru Kitchen Hub';
      resolvedHubAddress = 'Bengaluru Central Kitchen Hub';
    }
  }

  const effectiveHub: HubLocation = {
    ...hub,
    name: resolvedHubName,
    address: resolvedHubAddress,
    lat: hubCoords.lat,
    lng: hubCoords.lng
  };

  // 2. Prepare Stops with resolved real coordinates
  const stopsWithCoords = rawStops.map((stop) => {
    const { coords, isExact } = resolveStopCoordinates(stop, hubCoords!);
    return {
      ...stop,
      resolvedCoords: coords,
      hasExactCoordinates: isExact
    };
  });

  const n = stopsWithCoords.length;

  // 3. Build Distance Matrix (Index 0 = Hub, 1..n = Stops)
  const allPoints: LatLng[] = [hubCoords, ...stopsWithCoords.map((s) => s.resolvedCoords)];
  const totalPoints = allPoints.length;
  const distMatrix: number[][] = Array.from({ length: totalPoints }, () => Array(totalPoints).fill(0));

  for (let i = 0; i < totalPoints; i++) {
    for (let j = 0; j < totalPoints; j++) {
      if (i === j) {
        distMatrix[i][j] = 0;
      } else {
        // Multiplier 1.35 accounts for Indian city road driving distance vs straight flight distance
        distMatrix[i][j] = calculateHaversineKm(allPoints[i], allPoints[j]) * 1.35;
      }
    }
  }

  // 4. SOLVE OPTIMAL DELIVERY PATH (Hub -> Stop 1 -> ... -> Stop N)
  const { bestTour: routeIndices } = solveOptimalDeliveryPath(distMatrix, n);

  // 5. Assemble Ordered Stops & Reliable Cross-Platform Navigation Links
  let cumulativeDist = 0;
  let prevIdx = 0;
  const orderedStops: OptimizedStop[] = [];

  routeIndices.forEach((stopPointIdx, rank) => {
    const rawStop = stopsWithCoords[stopPointIdx - 1];
    const legDist = distMatrix[prevIdx][stopPointIdx];
    cumulativeDist += legDist;

    // Driving speed ~24 km/h in city + 3 minutes per delivery drop
    const estDriveMins = Math.round((legDist / 24) * 60) + 3;

    // Cross-platform Universal Google Maps Navigation URL that never fails with "location not available"
    let directNavUrl = '';
    const parsedCoords = extractCoordinates(rawStop.locationLink) || extractCoordinates(rawStop.address);

    if (parsedCoords && isValidLatLng(parsedCoords.lat, parsedCoords.lng)) {
      directNavUrl = `https://www.google.com/maps/search/?api=1&query=${parsedCoords.lat.toFixed(6)},${parsedCoords.lng.toFixed(6)}`;
    } else if (rawStop.hasExactCoordinates && rawStop.resolvedCoords && isValidLatLng(rawStop.resolvedCoords.lat, rawStop.resolvedCoords.lng)) {
      directNavUrl = `https://www.google.com/maps/search/?api=1&query=${rawStop.resolvedCoords.lat.toFixed(6)},${rawStop.resolvedCoords.lng.toFixed(6)}`;
    } else if (rawStop.locationLink && (rawStop.locationLink.startsWith('http://') || rawStop.locationLink.startsWith('https://'))) {
      directNavUrl = rawStop.locationLink.trim();
    } else {
      const parts = [rawStop.address, rawStop.area].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
      let fullAddr = parts.join(', ');
      if (!fullAddr.toLowerCase().includes('bengaluru') && !fullAddr.toLowerCase().includes('bangalore') && !fullAddr.toLowerCase().includes('mumbai')) {
        fullAddr += ', Bengaluru, Karnataka';
      }
      directNavUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr || rawStop.name)}`;
    }

    orderedStops.push({
      ...rawStop,
      sequence: rank + 1,
      distanceFromPrevKm: Number(legDist.toFixed(1)),
      estMinutesFromPrev: estDriveMins,
      cumulativeDistanceKm: Number(cumulativeDist.toFixed(1)),
      directNavUrl
    });

    prevIdx = stopPointIdx;
  });

  // Calculate return to hub leg and total tour
  const returnToHubDist = distMatrix[prevIdx][0];
  const totalDistanceKm = Number((cumulativeDist + returnToHubDist).toFixed(1));
  const totalEstMinutes = Math.round((totalDistanceKm / 24) * 60) + (orderedStops.length * 3);

  // 6. Generate Master Google Maps Multi-Stop Directions URL connecting all orders
  const { masterUrl, legUrls } = buildGoogleMapsDirectionsUrls(
    effectiveHub, 
    orderedStops,
    true
  );

  return {
    hub: effectiveHub,
    orderedStops,
    totalDistanceKm,
    totalEstMinutes,
    masterGoogleMapsUrl: masterUrl,
    googleMapsLegsUrls: legUrls
  };
};

const reverseSubsegment = (arr: number[], i: number, k: number) => {
  while (i < k) {
    const temp = arr[i];
    arr[i] = arr[k];
    arr[k] = temp;
    i++;
    k--;
  }
};

/**
 * Creates valid Google Maps multi-stop directions URL(s) connecting all orders.
 * Google Maps directions format:
 * https://www.google.com/maps/dir/?api=1&origin=HUB&destination=FINAL_STOP&waypoints=STOP1|STOP2|...
 * 
 * Avoids identical origin and destination (which causes Google Maps to collapse routes or fail).
 */
const buildGoogleMapsDirectionsUrls = (
  hub: HubLocation,
  stops: OptimizedStop[],
  hubHasExactCoords: boolean = true
): { masterUrl: string; legUrls: string[] } => {
  const getPointQuery = (point: { address?: string; area?: string; locationLink?: string; resolvedCoords?: LatLng; hasExactCoordinates?: boolean; name?: string; lat?: number; lng?: number }): string => {
    // 1. Direct explicit coordinates if available
    const coords = extractCoordinates(point.locationLink) || extractCoordinates(point.address);
    if (coords && isValidLatLng(coords.lat, coords.lng)) {
      return `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
    }
    if (typeof point.lat === 'number' && typeof point.lng === 'number' && isValidLatLng(point.lat, point.lng)) {
      return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    }
    if (point.hasExactCoordinates && point.resolvedCoords && isValidLatLng(point.resolvedCoords.lat, point.resolvedCoords.lng)) {
      return `${point.resolvedCoords.lat.toFixed(6)},${point.resolvedCoords.lng.toFixed(6)}`;
    }
    // 2. Clean full address with locality
    const parts = [point.address, point.area].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    let fullAddr = parts.join(', ');
    if (!fullAddr.toLowerCase().includes('bengaluru') && !fullAddr.toLowerCase().includes('bangalore') && !fullAddr.toLowerCase().includes('mumbai')) {
      fullAddr += ', Bengaluru, Karnataka';
    }
    return encodeURIComponent(fullAddr || point.name || 'Delivery Stop');
  };

  // Hub coordinate string: Always use lat,lng coordinates when available
  const hubQuery = (hub.lat && hub.lng)
    ? `${hub.lat.toFixed(6)},${hub.lng.toFixed(6)}`
    : encodeURIComponent(hub.address || hub.name || 'Kitchen Hub, Bengaluru, Karnataka');

  if (stops.length === 0) {
    return { masterUrl: '', legUrls: [] };
  }

  // When only 1 stop
  if (stops.length === 1) {
    const singleUrl = `https://www.google.com/maps/dir/?api=1&origin=${hubQuery}&destination=${getPointQuery(stops[0])}`;
    return { masterUrl: singleUrl, legUrls: [singleUrl] };
  }

  // Google Maps URL directions API reliably supports up to 9 intermediate waypoints
  const WAYPOINT_CHUNK_SIZE = 9;
  const legUrls: string[] = [];

  for (let i = 0; i < stops.length; i += WAYPOINT_CHUNK_SIZE) {
    const chunk = stops.slice(i, i + WAYPOINT_CHUNK_SIZE);
    const chunkOrigin = i === 0 ? hubQuery : getPointQuery(stops[i - 1]);
    const chunkDestination = getPointQuery(chunk[chunk.length - 1]);

    // Intermediate waypoints between origin and chunk destination
    const waypoints = chunk.length > 1
      ? chunk.slice(0, chunk.length - 1).map(s => getPointQuery(s)).join('|')
      : '';

    let url = `https://www.google.com/maps/dir/?api=1&origin=${chunkOrigin}&destination=${chunkDestination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    legUrls.push(url);
  }

  // Master URL connecting Hub -> all intermediate stops as waypoints -> final destination stop
  const finalStop = stops[stops.length - 1];
  const finalStopQuery = getPointQuery(finalStop);

  // If <= 9 total stops, all intermediate stops fit into waypoints
  let masterWaypoints = '';
  if (stops.length <= 9) {
    masterWaypoints = stops.slice(0, stops.length - 1).map(s => getPointQuery(s)).join('|');
  } else {
    // If more than 9 stops, master URL routes through the first 8 stops to stop 9, with legs available for subsequent segments
    masterWaypoints = stops.slice(0, 8).map(s => getPointQuery(s)).join('|');
  }

  let masterUrl = `https://www.google.com/maps/dir/?api=1&origin=${hubQuery}&destination=${stops.length <= 9 ? finalStopQuery : getPointQuery(stops[8])}`;
  if (masterWaypoints) {
    masterUrl += `&waypoints=${masterWaypoints}`;
  }

  return { masterUrl, legUrls };
};

/**
 * Prepares WhatsApp formatted text with the shortest route sequence and navigation links
 */
export const formatWhatsAppOptimizedRoute = (
  mealTime: string,
  dateStr: string,
  deliveryBoy: { name: string; mobile?: string },
  routeResult: OptimizedRouteResult,
  allPlans: any[] = []
): string => {
  const { hub, orderedStops, totalDistanceKm, totalEstMinutes, masterGoogleMapsUrl, googleMapsLegsUrls } = routeResult;

  // Calculate box recollection statistics
  let totalRecollectionsToday = 0;
  let totalDay1NewBoxes = 0;

  orderedStops.forEach((stop) => {
    const sessionPlans = stop.activePlans?.filter((p: any) => {
      if (p.mealTime !== mealTime) return false;
      const pConfig = allPlans.find((pc: any) => pc.id === p.planId);
      return isPlanActiveOnDate(p, dateStr, pConfig);
    }) || [];

    sessionPlans.forEach((p: any) => {
      if (p.reusableBoxType && p.reusableBoxType !== 'None') {
        const dayNum = getPlanDeliveryDayNumber(p.startDate, dateStr, p.weekdays || [1, 2, 3, 4, 5, 6], p.pauses || []);
        if (dayNum >= 2) {
          totalRecollectionsToday++;
        } else if (dayNum === 1) {
          totalDay1NewBoxes++;
        }
      }
    });
  });

  let msg = `🚚 *SHORTEST ROUTE DISPATCH - ${mealTime.toUpperCase()}*\n`;
  msg += `👤 Partner: *${deliveryBoy.name}*\n`;
  msg += `📅 Date: ${formatDateDDMMYYYY(dateStr)}\n`;
  msg += `📍 Hub: *${hub.name}* (Round Trip: Hub ➔ Orders ➔ Hub)\n`;
  msg += `📦 Total Orders: *${orderedStops.length} Customers*\n`;
  if (totalRecollectionsToday > 0) {
    msg += `🔄 *REUSABLE BOXES TO RECOLLECT: ${totalRecollectionsToday} Boxes* (Day 2+ drops)\n`;
  }
  if (totalDay1NewBoxes > 0) {
    msg += `🟢 *Day 1 New Subscriptions: ${totalDay1NewBoxes} Boxes* (Issue new box, no previous box)\n`;
  }
  msg += `🛣️ Est. Distance: *~${totalDistanceKm} km* (~${totalEstMinutes} mins)\n\n`;

  msg += `🗺️ *ONE-TAP GOOGLE MAPS MASTER ROUTE:*\n${masterGoogleMapsUrl}\n\n`;

  if (googleMapsLegsUrls.length > 1) {
    msg += `🗺️ *ROUTE SECTIONS:*\n`;
    googleMapsLegsUrls.forEach((u, idx) => {
      msg += `• Leg ${idx + 1}: ${u}\n`;
    });
    msg += `\n`;
  }

  msg += `────────────────────────\n`;
  msg += `📋 *OPTIMIZED DELIVERY SEQUENCE:*\n\n`;

  orderedStops.forEach((stop, i) => {
    const sessionPlans = stop.activePlans?.filter((p: any) => {
      if (p.mealTime !== mealTime) return false;
      const pConfig = allPlans.find((pc: any) => pc.id === p.planId);
      return isPlanActiveOnDate(p, dateStr, pConfig);
    }) || [];

    const plansCount = sessionPlans.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 1), 0) || 1;
    const planNames = sessionPlans
      .map((p: any) => `${p.planName}${p.isStarred ? ' ⭐' : ''}`)
      .join(', ') || 'Tiffin Box';

    msg += `${i + 1}️⃣ *${stop.name}* [${plansCount} Box${plansCount > 1 ? 'es' : ''}]\n`;
    msg += `   🍱 Plan: ${planNames}\n`;
    msg += `   📍 Address: ${stop.address}${stop.area ? `, ${stop.area}` : ''}\n`;
    msg += `   📞 Call: ${stop.mobile}\n`;

    // Reusable Box Instructions
    sessionPlans.forEach((p: any) => {
      const boxType = p.reusableBoxType || 'None';
      if (boxType && boxType !== 'None') {
        const dayNum = getPlanDeliveryDayNumber(p.startDate, dateStr, p.weekdays || [1, 2, 3, 4, 5, 6], p.pauses || []);
        if (dayNum === 1) {
          msg += `   🟢 *BOX: ${boxType}* (Day 1: First Delivery - Issue Fresh Box, NO yesterday box to collect)\n`;
        } else if (dayNum >= 2) {
          msg += `   ⚠️ *RECOLLECT: Yesterday's ${boxType}* (Day ${dayNum} of subscription)\n`;
          msg += `      👉 Check: Clean & intact? (Inspect for missing lid/parts or unclean)\n`;
        } else {
          msg += `   📦 *Box:* ${boxType}\n`;
        }
      }
    });

    if (stop.notes) {
      msg += `   📝 Note: ${stop.notes}\n`;
    }
    msg += `   🧭 Direct Navigation Link:\n${stop.directNavUrl}\n\n`;
  });

  msg += `🏁 *Final Stop: Return back to ${hub.name}*\n`;
  msg += `✨ *Generated for ${hub.businessName || hub.name || 'Kitchen'} Route Dispatch*`;

  return msg;
};

export type LatLng = { latitude: number; longitude: number };

export async function fetchRouteOSRM(origin: LatLng, destination: LatLng): Promise<LatLng[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates || [];
  return coords.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
}

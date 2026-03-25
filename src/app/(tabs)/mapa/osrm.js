export async function fetchOSRMRoute(coordinates, signal) {
  async function requestOSRM(coords) {
    if (coords.length < 2) return null;
    const coordStr = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(url, signal ? { signal } : undefined);
    if (!resp.ok) return null;
    const data = await resp.json();
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates) return null;
    const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const steps = [];
    route.legs?.forEach((leg) => {
      leg.steps?.forEach((step) => {
        if (step?.maneuver?.instruction) steps.push(step.maneuver.instruction);
      });
    });
    return {
      latLngs,
      distanceMeters: route.distance ?? 0,
      durationSeconds: route.duration ?? 0,
      steps,
    };
  }

  try {
    const directRoute = await requestOSRM(coordinates);
    if (directRoute && directRoute.latLngs.length >= 2) {
      const snapped = [...directRoute.latLngs];
      snapped[0] = coordinates[0];
      snapped[snapped.length - 1] = coordinates[coordinates.length - 1];
      return {
        ...directRoute,
        latLngs: snapped,
      };
    }

    if (coordinates.length < 3) {
      return null;
    }

    let merged = [];
    let totalDistance = 0;
    let totalDuration = 0;
    const allSteps = [];

    for (let index = 1; index < coordinates.length; index += 1) {
      if (signal?.aborted) return null;
      const segmentCoords = [coordinates[index - 1], coordinates[index]];
      const segment = await requestOSRM(segmentCoords);

      if (!segment || segment.latLngs.length < 2) {
        merged = [];
        break;
      }

      const segmentLatLngs = [...segment.latLngs];
      segmentLatLngs[0] = segmentCoords[0];
      segmentLatLngs[segmentLatLngs.length - 1] = segmentCoords[1];

      if (merged.length === 0) {
        merged = segmentLatLngs;
      } else {
        merged = [...merged, ...segmentLatLngs.slice(1)];
      }

      totalDistance += segment.distanceMeters;
      totalDuration += segment.durationSeconds;
      allSteps.push(...segment.steps);
    }

    if (merged.length < 2) {
      return null;
    }

    merged[0] = coordinates[0];
    merged[merged.length - 1] = coordinates[coordinates.length - 1];

    return {
      latLngs: merged,
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      steps: allSteps,
    };
  } catch {
    return null;
  }
}

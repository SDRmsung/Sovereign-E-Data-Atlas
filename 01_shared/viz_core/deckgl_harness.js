/**
 * City Atlas deck.gl Layer Factory (A23_Data_Atlas / city_atlas / deckgl_layers)
 * Maps TDX / Freeway VD speed & volume telemetry to WebGL glowing arterial layers.
 * Color semantics:
 *   - Congested (< 45 km/h): Amber [245, 158, 11, 235]
 *   - Moderate  (45-75 km/h): Cyan  [6, 182, 212, 215]
 *   - Smooth    (> 75 km/h): Sky   [56, 189, 248, 225]
 */
(function (global) {
  "use strict";

  function speedToRgba(speedKmh) {
    if (speedKmh < 45) return [245, 158, 11, 235];
    if (speedKmh < 75) return [6, 182, 212, 215];
    return [56, 189, 248, 225];
  }

  function buildCorridorSegments(stations) {
    if (!Array.isArray(stations) || stations.length < 2) return [];
    const mainNodes = stations.filter((s) => s.road !== "台74線");
    const segments = [];
    for (let i = 0; i < mainNodes.length - 1; i += 1) {
      const a = mainNodes[i];
      const b = mainNodes[i + 1];
      const avgSpeed = (Number(a.speed_kmh || 80) + Number(b.speed_kmh || 80)) / 2;
      const avgVol = (Number(a.volume_tpm || 60) + Number(b.volume_tpm || 60)) / 2;
      segments.push({
        id: `${a.id}->${b.id}`,
        path: [
          [a.lon, a.lat],
          [b.lon, b.lat]
        ],
        speed_kmh: avgSpeed,
        volume_tpm: avgVol
      });
    }
    return segments;
  }

  /**
   * Creates deck.gl layers when `window.deck` is loaded on a MapLibre / Mapbox page.
   */
  function createCityAtlasDeckLayers(feedData) {
    if (!global.deck || !feedData) return [];
    const stations = feedData.stations || [];
    const segments = buildCorridorSegments(stations);

    const glowPathLayer = new global.deck.PathLayer({
      id: "city-atlas-corridor-glow",
      data: segments,
      getPath: (d) => d.path,
      getColor: (d) => {
        const c = speedToRgba(d.speed_kmh);
        return [c[0], c[1], c[2], 90];
      },
      getWidth: (d) => Math.max(6, Math.min(22, d.volume_tpm / 8)),
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      parameters: { blend: true }
    });

    const corePathLayer = new global.deck.PathLayer({
      id: "city-atlas-corridor-core",
      data: segments,
      getPath: (d) => d.path,
      getColor: (d) => speedToRgba(d.speed_kmh),
      getWidth: 2.5,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true
    });

    const vdScatterLayer = new global.deck.ScatterplotLayer({
      id: "city-atlas-vd-nodes",
      data: stations,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => speedToRgba(d.speed_kmh),
      getRadius: (d) => (d.congested ? 4200 : 2600),
      radiusMinPixels: 3,
      radiusMaxPixels: 9,
      pickable: true
    });

    return [glowPathLayer, corePathLayer, vdScatterLayer];
  }

  global.CityAtlasDeckSpec = {
    speedToRgba: speedToRgba,
    buildCorridorSegments: buildCorridorSegments,
    createCityAtlasDeckLayers: createCityAtlasDeckLayers
  };
})(window);


// Shared A23 Deck.gl Color & Camera Presets (s01 - s12)
window.A23DeckHarness = {
  PALETTE: {
    skySmooth: [56, 189, 248, 225],
    cyanNormal: [6, 182, 212, 215],
    emeraldOasis: [16, 185, 129, 220],
    amberCongested: [245, 158, 11, 235],
    roseAlert: [244, 63, 94, 240],
    violetPlume: [217, 70, 239, 210]
  },
  TAIWAN_VIEW_STATE: {
    longitude: 120.95,
    latitude: 23.78,
    zoom: 7.4,
    pitch: 42,
    bearing: -12
  }
};

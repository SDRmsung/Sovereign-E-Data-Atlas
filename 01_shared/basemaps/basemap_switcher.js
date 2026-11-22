/* A23 共用底圖切換模組 (n02 §3)：MapLibre + Web Mercator，數據層用 project() 取螢幕座標。
 * 用法：const bm = A23Basemap.create({container:"basemap", bounds:{minLon,maxLon,minLat,maxLat}, labelEl});
 *       bm.project(lon,lat) -> {x,y}；bm.on("mousemove", fn)；bm.cycle() 切底圖。
 * 需先載入 maplibre-gl@4.7.1 (css+js)。 */
(function (global) {
  const BG = { id: "bg", type: "background", paint: { "background-color": "#030712" } };
  const STYLES = {
    // dem_dark：高程 hillshade 暗色立體底圖 (L*<18)。圖磚暫用 AWS Terrarium 全球 DEM（免 key），
    // 待內政部 20m DEM 轉製 Terrain-RGB 後替換 tiles/encoding（見 n02 §1）
    dem_dark: { version: 8, sources: { dem: { type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: 14,
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        attribution: "Terrain: AWS Terrain Tiles (SRTM/NASADEM 等)" } },
      layers: [BG, { id: "hs", type: "hillshade", source: "dem",
        paint: { "hillshade-exaggeration": 1.0, "hillshade-shadow-color": "#030712", "hillshade-highlight-color": "#1b2a44", "hillshade-accent-color": "#0b1324" } }] },
    // osm_dark：OSM 柵格反相壓暗 (L*<18)，免 key；低流量使用，上線改自架圖磚
    osm_dark: { version: 8, sources: { c: { type: "raster", tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"] } },
      layers: [BG, { id: "c", type: "raster", source: "c",
        paint: { "raster-brightness-min": 0.30, "raster-brightness-max": 0.05, "raster-saturation": -1, "raster-contrast": 0.7 } }] }
    // google_ref：待 API key 決策，未實作
  };
  const ORDER = ["dem_dark", "osm_dark"];
  function create(opt) {
    let idx = 0;
    const b = opt.bounds;
    const map = new maplibregl.Map({ container: opt.container, style: STYLES[ORDER[0]], center: [(b.minLon + b.maxLon) / 2, (b.minLat + b.maxLat) / 2], zoom: 11, attributionControl: true });
    map.fitBounds([[b.minLon, b.minLat], [b.maxLon, b.maxLat]], { padding: opt.padding || 60, animate: false });
    const label = () => { if (opt.labelEl) opt.labelEl.textContent = "底圖: " + ORDER[idx]; };
    label();
    return {
      map,
      project(lon, lat) { const p = map.project([lon, lat]); return { x: p.x, y: p.y }; },
      on(ev, fn) { map.on(ev, fn); },
      current() { return ORDER[idx]; },
      cycle() { idx = (idx + 1) % ORDER.length; map.setStyle(STYLES[ORDER[idx]]); label(); return ORDER[idx]; }
    };
  }
  global.A23Basemap = { create, STYLES, ORDER };
})(window);

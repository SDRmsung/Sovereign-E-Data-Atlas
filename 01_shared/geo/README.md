# 01_shared/geo — 臺灣行政區界

- 來源：內政部鄉鎮市區界，經 npm 套件 taiwan-atlas 2021.9.20（towns-10t.json，MIT，授權見 taiwan-atlas_LICENSE.txt）
- `tw_towns_2021.geojson`：368 鄉鎮市區完整 GeoJSON（屬性 TOWNNAME/COUNTYNAME/TOWNCODE…）
- `tw_towns_2021_rings.js`：`window.A23_TW_TOWNS=[{key:縣市+鄉鎮, county, name, code, rings}]`，只取外環、四位小數，可直接餵 `A23Charts.choropleth`
- 縣市名用「台」字（台北市、台中市…），對值時注意與「臺」統一
- 用法：`C.choropleth(cv,{features:A23_TW_TOWNS.filter(..).map(t=>({key:t.name,name:t.name,rings:t.rings})),frames},{fitData:true})`
- 限制：2021 版界；10t 量化已簡化，適合總覽，不適合精細邊界判定

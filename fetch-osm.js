const fs = require('fs');

async function fetchMetroGeoJSON() {
  const query = `
    [out:json][timeout:25];
    (
      relation["route"="subway"]["network"="SL"];
    );
    out body;
    >;
    out skel qt;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  
  console.log("Fetching from Overpass API...");
  const res = await fetch(url);
  const data = await res.json();
  
  // Very rough generic way to convert OSM to GeoJSON, though Overpass doesn't return direct GeoJSON.
  // Instead, let's use an existing library like osmtogeojson, or just fetch directly from an overpass frontend that returns geojson!
}

fetchMetroGeoJSON();

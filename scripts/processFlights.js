const fs   = require('fs');
const zlib = require('zlib');
const path = require('path');

// Closest snapshot to the May 22nd event
const DATA_PATH = path.join(
  __dirname,
  '../../hackathon_data_bundle/asked_at_2025-05-29T21:00:00Z/routes.json.gz'
);

const TFR = { minLat: 20.5, maxLat: 27.4, minLon: -101.0, maxLon: -90.0 };

function inTFR(lat, lon) {
  return lat >= TFR.minLat && lat <= TFR.maxLat &&
         lon >= TFR.minLon && lon <= TFR.maxLon;
}

function isAffected(lats, lons) {
  return lats.some((lat, i) => inTFR(lat, lons[i]));
}

function flightProgress(flight, askedAt) {
  const takeoff  = new Date(flight.take_off_time).getTime();
  const landing  = new Date(flight.scheduled_landing_time).getTime();
  const snapshot = new Date(askedAt).getTime();
  if (snapshot <= takeoff) return 0;
  if (snapshot >= landing) return 1;
  return (snapshot - takeoff) / (landing - takeoff);
}

// Load + decompress
const raw  = fs.readFileSync(DATA_PATH);
const json = JSON.parse(zlib.gunzipSync(raw).toString());

console.log(`Total flights in snapshot: ${json.flights.length}`);
console.log(`Snapshot time: ${json.asked_at}`);

const processed = json.flights
  // Must have valid waypoints
  .filter(f => f.lats && f.lons && f.lats.length >= 2)
  // Only CONUS region flights
  .filter(f => {
    const lat = f.lats[0], lon = f.lons[0];
    return lat > 18 && lat < 52 && lon > -130 && lon < -60;
  })
  // Limit to 60 flights for map performance
  .slice(0, 60)
  .map((f, i) => {
    const waypoints = f.lats.map((lat, j) => [
      parseFloat(lat.toFixed(4)),
      parseFloat(f.lons[j].toFixed(4)),
    ]);

    const affected  = isAffected(f.lats, f.lons);
    const progress  = flightProgress(f, json.asked_at);

    return {
      id:          `${f.flight_number}_${i}`,
      callsign:    f.flight_number,
      from:        f.origin_airport_icao,
      to:          f.destination_airport_icao,
      fromName:    f.origin_airport_icao,
      toName:      f.destination_airport_icao,
      altitude:    f.cruise_altitude_ft,
      speed:       f.cruise_speed_kt,
      isAirborne:  f.is_airborne,
      affected,
      phaseOffset: parseFloat(progress.toFixed(4)),
      waypoints,
    };
  });

const affected = processed.filter(f => f.affected).length;
console.log(`Kept: ${processed.length} flights  |  TFR affected: ${affected}`);

// Write output
const out = `// Auto-generated from routes.json.gz — ${json.asked_at}
// ${processed.length} flights · ${affected} TFR-affected

export const SNAPSHOT_TIME = "${json.asked_at}";

export const flights = ${JSON.stringify(processed, null, 2)};
`;

const outPath = path.join(__dirname, '../src/data/realFlights.js');
fs.writeFileSync(outPath, out);
console.log(`✓ Written to src/data/realFlights.js`);
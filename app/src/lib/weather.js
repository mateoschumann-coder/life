// Wetter über Open-Meteo (kostenlos, ohne Schlüssel). Standort vom iPhone, sonst Buenos Aires.
const LOC_KEY = 'life-app-loc';
const WX_KEY = 'life-app-weather';
const FALLBACK = { lat: -34.6037, lon: -58.3816, name: 'Buenos Aires', fallback: true };

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

function getCoords() {
  const cached = read(LOC_KEY);
  if (cached && Date.now() - cached.ts < 6 * 3600e3) return Promise.resolve(cached);
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(cached || FALLBACK);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: 'Dein Standort', ts: Date.now() };
        write(LOC_KEY, loc);
        resolve(loc);
      },
      () => resolve(cached || FALLBACK),
      { timeout: 8000, maximumAge: 3600e3 }
    );
  });
}

export async function loadWeather(force = false) {
  const cached = read(WX_KEY);
  if (!force && cached && Date.now() - cached.ts < 30 * 60e3) return cached;
  const loc = await getCoords();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max' +
    '&forecast_days=7&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Wetter nicht erreichbar');
  const data = await res.json();
  const wx = { ts: Date.now(), place: loc.name, fallback: !!loc.fallback, current: data.current, daily: data.daily };
  write(WX_KEY, wx);
  return wx;
}

export function describeCode(code) {
  if (code === 0) return { label: 'Klar', icon: 'sun' };
  if (code <= 2) return { label: 'Leicht bewölkt', icon: 'cloudSun' };
  if (code === 3) return { label: 'Bewölkt', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Nebel', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { label: 'Nieselregen', icon: 'rain' };
  if (code >= 61 && code <= 67) return { label: 'Regen', icon: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Schnee', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Schauer', icon: 'rain' };
  if (code >= 95) return { label: 'Gewitter', icon: 'storm' };
  return { label: 'Wechselhaft', icon: 'cloudSun' };
}

// Konkreter Tipp, was man anziehen und mitnehmen sollte
export function clothingTip({ tmax, tmin, rain, wind, uv }) {
  const parts = [];
  if (tmax >= 29) parts.push('T-Shirt und kurze Hose, viel trinken');
  else if (tmax >= 23) parts.push(tmin < 15 ? 'T-Shirt, für abends eine dünne Schicht' : 'T-Shirt reicht');
  else if (tmax >= 17) parts.push('Pullover oder leichte Jacke');
  else if (tmax >= 10) parts.push('Jacke anziehen');
  else parts.push('Warme Jacke, Schal');
  if (rain >= 50) parts.push('Regenschirm einpacken');
  else if (rain >= 30) parts.push('evtl. Schirm');
  if (wind >= 35) parts.push('windig');
  if (uv >= 7) parts.push('Sonnencreme');
  return parts.join(' · ');
}

// Tageswerte für ein Datum (JJJJ-MM-TT), falls in der 7-Tage-Vorhersage enthalten
export function dayForecast(wx, key) {
  if (!wx?.daily?.time) return null;
  const i = wx.daily.time.indexOf(key);
  if (i < 0) return null;
  const d = wx.daily;
  return {
    code: d.weather_code[i],
    tmax: Math.round(d.temperature_2m_max[i]),
    tmin: Math.round(d.temperature_2m_min[i]),
    rain: d.precipitation_probability_max?.[i] ?? 0,
    uv: d.uv_index_max?.[i] ?? 0,
    wind: d.wind_speed_10m_max?.[i] ?? 0,
  };
}

const BASE = 'https://api.open-meteo.com/v1/forecast';

export async function fetchForecast({ lat, lon }) {
  const url = `${BASE}?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = await res.json();
  const days = (j.daily?.time || []).map((date, i) => ({
    date,
    snowCm: j.daily.snowfall_sum?.[i] || 0,
    tmax: j.daily.temperature_2m_max?.[i],
    tmin: j.daily.temperature_2m_min?.[i],
    estimated: false,
  }));
  return { source: 'Open-Meteo', days, estimated: false };
}

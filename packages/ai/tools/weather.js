const WEATHER_CODES = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'depositing rime fog', 51: 'light drizzle', 53: 'drizzle',
  55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'light rain showers',
  81: 'rain showers', 82: 'heavy rain showers', 95: 'thunderstorm'
};

function weatherLocationFromPrompt(prompt) {
  const text = String(prompt || '').trim();
  if (!/\b(weather|forecast|temperature)\b/i.test(text)) return null;
  const match = text.match(/\b(?:weather|forecast|temperature)\b.*?\b(?:in|for|at)\s+([^?.,]+)/i);
  return match ? match[1].replace(/\s+\b(today|now|tomorrow)\b.*$/i, '').trim() : '';
}

async function getWeatherContext(prompt) {
  const location = weatherLocationFromPrompt(prompt);
  if (location === null) return { matched: false };
  if (!location) return { matched: true, needsLocation: true };
  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.search = new URLSearchParams({ name: location, count: '1', language: 'en', format: 'json' });
  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) throw new Error('Weather location lookup failed');
  const place = (await geoResponse.json()).results?.[0];
  if (!place) return { matched: true, error: `I could not find “${location}”. Try a city and country, such as “weather in Amsterdam, Netherlands”.` };
  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    timezone: 'auto'
  });
  const response = await fetch(forecastUrl);
  if (!response.ok) throw new Error('Current weather lookup failed');
  const body = await response.json();
  const current = body.current || {};
  const units = body.current_units || {};
  return {
    matched: true,
    context: [
      'LIVE WEATHER DATA FROM OPEN-METEO:',
      `Location: ${place.name}, ${place.admin1 || place.country || ''}`,
      `Observed/model time: ${current.time} (${body.timezone || 'local time'})`,
      `Conditions: ${WEATHER_CODES[current.weather_code] || `weather code ${current.weather_code}`}`,
      `Temperature: ${current.temperature_2m}${units.temperature_2m || '°C'}`,
      `Feels like: ${current.apparent_temperature}${units.apparent_temperature || '°C'}`,
      `Precipitation: ${current.precipitation}${units.precipitation || 'mm'}`,
      `Wind: ${current.wind_speed_10m}${units.wind_speed_10m || 'km/h'}`,
      'Attribute current conditions to Open-Meteo.'
    ].join('\n')
  };
}

module.exports = { WEATHER_CODES, weatherLocationFromPrompt, getWeatherContext };

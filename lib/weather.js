/**
 * lib/weather.js
 * Fetches Coorg / Virajpet weather from OpenWeatherMap.
 */

const IST_OFFSET_HOURS = 5.5;

// OpenWeatherMap API — set OPENWEATHER_API_KEY in environment
// Virajpet, Karnataka coordinates
const COORG_LAT = 12.5464;
const COORG_LON = 75.7620;
const OW_URL = `https://api.openweathermap.org/data/2.5/weather?lat=${COORG_LAT}&lon=${COORG_LON}&units=metric&appid=${process.env.OPENWEATHER_API_KEY || ''}`;

/**
 * @typedef {object} Weather
 * @property {string} condition
 * @property {number} temp
 * @property {string} icon
 * @property {string} description
 */

/** @type {Weather|null} */
let cachedWeather = null;
let weatherCacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch current weather for Coorg.
 * Falls back gracefully if API key is missing or request fails.
 * @returns {Promise<Weather>}
 */
async function getWeather() {
  const now = Date.now();

  // Return cached weather if fresh
  if (cachedWeather && (now - weatherCacheTime) < CACHE_TTL_MS) {
    return cachedWeather;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('[weather] OPENWEATHER_API_KEY not set — using default');
    return defaultWeather();
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${COORG_LAT}&lon=${COORG_LON}&units=metric&appid=${apiKey}`;
    const response = await fetch(url, { timeout: 5000 });
    if (!response.ok) {
      throw new Error(`OW API returned ${response.status}`);
    }
    const data = await response.json();

    cachedWeather = {
      condition: data.weather && data.weather[0] ? data.weather[0].main : 'Clear',
      temp: Math.round(data.main && data.main.temp ? data.main.temp : 22),
      icon: data.weather && data.weather[0] ? data.weather[0].icon : '01d',
      description: data.weather && data.weather[0] ? data.weather[0].description : 'clear sky',
    };
    weatherCacheTime = now;
    return cachedWeather;
  } catch (err) {
    console.error('[weather] Fetch failed, using default:', err.message);
    return defaultWeather();
  }
}

/**
 * Fallback weather when API is unavailable.
 * @returns {Weather}
 */
function defaultWeather() {
  return {
    condition: 'pleasant',
    temp: 24,
    icon: '01d',
    description: 'pleasant weather in Coorg',
  };
}

module.exports = { getWeather, defaultWeather };

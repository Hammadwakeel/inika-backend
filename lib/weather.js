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
 * Map OpenWeatherMap condition codes to Coorg-specific natural language.
 * Coorg is a hill station — conditions are milder and more lush than typical.
 * @param {number} code
 * @returns {string}
 */
function conditionFromCode(code) {
  if (code >= 200 && code < 300) return 'Thunder rumbles in the hills';
  if (code >= 300 && code < 400) return 'A light mist';
  if (code >= 500 && code < 520) return 'Gentle rain';
  if (code >= 520 && code < 600) return 'Rainy';
  if (code >= 600 && code < 700) return 'Cool and misty';
  if (code >= 700 && code < 800) return 'Foggy';
  if (code === 800) return 'Clear skies';
  if (code === 801) return 'Sunny with a few clouds';
  if (code === 802) return 'Partly cloudy';
  if (code >= 803) return 'Overcast';
  return 'Pleasant';
}

/**
 * @typedef {object} Weather
 * @property {string} condition
 * @property {number} temp
 * @property {string} icon
 * @property {string} description
 * @property {number} humidity
 * @property {number} windSpeed
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
      condition: conditionFromCode(data.weather && data.weather[0] ? data.weather[0].id : 800),
      temp: Math.round(data.main && data.main.temp ? data.main.temp : 22),
      icon: data.weather && data.weather[0] ? data.weather[0].icon : '01d',
      description: data.weather && data.weather[0] ? data.weather[0].description : 'clear sky',
      humidity: data.main ? data.main.humidity : 60,
      windSpeed: data.wind ? Math.round(data.wind.speed * 3.6) : 0,
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
    condition: 'Pleasant',
    temp: 24,
    icon: '01d',
    description: 'pleasant weather in Coorg',
    humidity: 65,
    windSpeed: 5,
  };
}

module.exports = { getWeather, defaultWeather };

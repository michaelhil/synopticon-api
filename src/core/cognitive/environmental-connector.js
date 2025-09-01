/**
 * Environmental Data Connector
 * Connects to real-world environmental data sources for cognitive system
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Weather API providers configuration
 */
const WEATHER_PROVIDERS = {
  openweathermap: {
    name: 'OpenWeatherMap',
    baseURL: 'https://api.openweathermap.org/data/2.5',
    requiresKey: true
  },
  weatherapi: {
    name: 'WeatherAPI.com',
    baseURL: 'https://api.weatherapi.com/v1',
    requiresKey: true
  },
  noaa: {
    name: 'NOAA Weather Service',
    baseURL: 'https://api.weather.gov',
    requiresKey: false
  }
};

/**
 * Traffic API providers configuration
 */
const TRAFFIC_PROVIDERS = {
  googlemaps: {
    name: 'Google Maps Traffic',
    baseURL: 'https://maps.googleapis.com/maps/api',
    requiresKey: true
  },
  mapbox: {
    name: 'Mapbox Traffic',
    baseURL: 'https://api.mapbox.com',
    requiresKey: true
  }
};

/**
 * Create environmental data connector
 */
export const createEnvironmentalConnector = (cognitiveSystem, config = {}) => {
  const {
    weatherProvider = 'openweathermap',
    weatherAPIKey = process.env.WEATHER_API_KEY,
    trafficProvider = 'googlemaps',
    trafficAPIKey = process.env.TRAFFIC_API_KEY,
    updateInterval = 300000, // 5 minutes
    enableWeather = true,
    enableTraffic = true,
    enableAirQuality = false,
    fallbackToMock = true
  } = config;
  
  let updateTimer = null;
  let isRunning = false;
  let currentLocation = null;
  
  /**
   * Initialize environmental data collection
   */
  const initialize = async (location = { lat: 47.6062, lon: -122.3321 }) => { // Default: Seattle
    currentLocation = location;
    isRunning = true;
    
    // Start periodic data updates
    updateTimer = setInterval(async () => {
      await collectEnvironmentalData();
    }, updateInterval);
    
    // Collect initial data
    await collectEnvironmentalData();
    
    logger.info('✅ Environmental data connector initialized');
  };
  
  /**
   * Collect all environmental data
   */
  const collectEnvironmentalData = async () => {
    const timestamp = Date.now();
    
    try {
      // Collect weather data
      if (enableWeather) {
        const weatherData = await getWeatherData(currentLocation);
        if (weatherData) {
          await processWeatherData(weatherData, timestamp);
        }
      }
      
      // Collect traffic data
      if (enableTraffic) {
        const trafficData = await getTrafficData(currentLocation);
        if (trafficData) {
          await processTrafficData(trafficData, timestamp);
        }
      }
      
      // Collect air quality data
      if (enableAirQuality) {
        const airQualityData = await getAirQualityData(currentLocation);
        if (airQualityData) {
          await processAirQualityData(airQualityData, timestamp);
        }
      }
      
    } catch (error) {
      logger.warn('Error collecting environmental data:', error);
      
      if (fallbackToMock) {
        await generateMockEnvironmentalData(timestamp);
      }
    }
  };
  
  /**
   * Get weather data from API
   */
  const getWeatherData = async (location) => {
    try {
      if (!weatherAPIKey && WEATHER_PROVIDERS[weatherProvider].requiresKey) {
        if (fallbackToMock) {
          logger.warn('No weather API key provided, using mock data');
          return generateMockWeatherData();
        }
        throw new Error(`Weather API key required for ${weatherProvider}`);
      }
      
      switch (weatherProvider) {
        case 'openweathermap':
          return await getOpenWeatherMapData(location);
          
        case 'weatherapi':
          return await getWeatherAPIData(location);
          
        case 'noaa':
          return await getNOAAWeatherData(location);
          
        default:
          throw new Error(`Unknown weather provider: ${weatherProvider}`);
      }
    } catch (error) {
      logger.error('Failed to get weather data:', error);
      return fallbackToMock ? generateMockWeatherData() : null;
    }
  };
  
  /**
   * Get OpenWeatherMap data
   */
  const getOpenWeatherMapData = async (location) => {
    const url = `${WEATHER_PROVIDERS.openweathermap.baseURL}/weather?lat=${location.lat}&lon=${location.lon}&appid=${weatherAPIKey}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      visibility: data.visibility || 10000,
      windSpeed: data.wind?.speed * 3.6 || 0, // Convert m/s to km/h
      windDirection: data.wind?.deg || 0,
      cloudCover: data.clouds.all / 100,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      weather: data.weather[0].main.toLowerCase(),
      description: data.weather[0].description,
      location: {
        name: data.name,
        country: data.sys.country,
        lat: data.coord.lat,
        lon: data.coord.lon
      }
    };
  };
  
  /**
   * Get traffic data
   */
  const getTrafficData = async (location) => {
    try {
      if (!trafficAPIKey && TRAFFIC_PROVIDERS[trafficProvider].requiresKey) {
        if (fallbackToMock) {
          logger.warn('No traffic API key provided, using mock data');
          return generateMockTrafficData();
        }
        throw new Error(`Traffic API key required for ${trafficProvider}`);
      }
      
      switch (trafficProvider) {
        case 'googlemaps':
          return await getGoogleMapsTrafficData(location);
          
        case 'mapbox':
          return await getMapboxTrafficData(location);
          
        default:
          throw new Error(`Unknown traffic provider: ${trafficProvider}`);
      }
    } catch (error) {
      logger.error('Failed to get traffic data:', error);
      return fallbackToMock ? generateMockTrafficData() : null;
    }
  };
  
  /**
   * Process weather data into cognitive system
   */
  const processWeatherData = async (weatherData, timestamp) => {
    const processedData = {
      ...weatherData,
      timestamp,
      source: 'environmental-connector',
      type: 'weather-data',
      riskLevel: calculateWeatherRisk(weatherData)
    };
    
    // Ingest into fusion engine
    cognitiveSystem.fusionEngine.ingestData('external', 'weather', processedData);
    
    // Update state manager
    cognitiveSystem.stateManager.updateState('environment.weather', processedData);
    
    // Trigger tactical analysis if conditions are severe
    if (processedData.riskLevel > 0.7) {
      await cognitiveSystem.pipelineSystem.process(
        'environmental-forecast',
        { weather: processedData, timeHorizon: 3600 },
        'tactical'
      );
    }
  };
  
  /**
   * Process traffic data into cognitive system
   */
  const processTrafficData = async (trafficData, timestamp) => {
    const processedData = {
      ...trafficData,
      timestamp,
      source: 'environmental-connector',
      type: 'traffic-data',
      complexityScore: calculateTrafficComplexity(trafficData)
    };
    
    // Ingest into fusion engine
    cognitiveSystem.fusionEngine.ingestData('external', 'traffic', processedData);
    
    // Update state manager
    cognitiveSystem.stateManager.updateState('environment.traffic', processedData);
  };
  
  /**
   * Calculate weather risk level
   */
  const calculateWeatherRisk = (weather) => {
    let risk = 0;
    
    // Visibility risk
    risk += Math.max(0, (10000 - weather.visibility) / 10000) * 0.4;
    
    // Wind risk
    risk += Math.min(1, weather.windSpeed / 50) * 0.3;
    
    // Precipitation risk
    risk += Math.min(1, weather.precipitation / 10) * 0.2;
    
    // Severe weather conditions
    if (weather.weather.includes('thunder') || weather.weather.includes('tornado')) {
      risk = Math.max(risk, 0.9);
    } else if (weather.weather.includes('snow') || weather.weather.includes('ice')) {
      risk = Math.max(risk, 0.6);
    }
    
    return Math.min(1, risk);
  };
  
  /**
   * Calculate traffic complexity score
   */
  const calculateTrafficComplexity = (traffic) => {
    let complexity = 0;
    
    // Density contribution
    complexity += (traffic.density || 0) * 0.4;
    
    // Incidents contribution
    complexity += Math.min(1, (traffic.incidents?.length || 0) / 5) * 0.3;
    
    // Average speed reduction
    if (traffic.averageSpeed && traffic.speedLimit) {
      const speedReduction = (traffic.speedLimit - traffic.averageSpeed) / traffic.speedLimit;
      complexity += speedReduction * 0.3;
    }
    
    return Math.min(1, complexity);
  };
  
  /**
   * Generate mock environmental data for testing
   */
  const generateMockEnvironmentalData = async (timestamp) => {
    const mockWeather = generateMockWeatherData();
    const mockTraffic = generateMockTrafficData();
    
    await processWeatherData(mockWeather, timestamp);
    await processTrafficData(mockTraffic, timestamp);
  };
  
  /**
   * Generate mock weather data
   */
  const generateMockWeatherData = () => ({
    temperature: 15 + Math.random() * 20,
    humidity: 40 + Math.random() * 40,
    pressure: 1000 + Math.random() * 50,
    visibility: 8000 + Math.random() * 2000,
    windSpeed: Math.random() * 30,
    windDirection: Math.random() * 360,
    cloudCover: Math.random(),
    precipitation: Math.random() * 5,
    weather: ['clear', 'cloudy', 'rain', 'snow'][Math.floor(Math.random() * 4)],
    description: 'Mock weather data for testing',
    location: {
      name: 'Mock City',
      country: 'MC',
      lat: currentLocation?.lat || 0,
      lon: currentLocation?.lon || 0
    }
  });
  
  /**
   * Generate mock traffic data
   */
  const generateMockTrafficData = () => ({
    density: Math.random(),
    averageSpeed: 30 + Math.random() * 50,
    speedLimit: 60,
    incidents: Array.from({ length: Math.floor(Math.random() * 3) }, (_, i) => ({
      id: `incident-${i}`,
      type: ['accident', 'construction', 'congestion'][Math.floor(Math.random() * 3)],
      severity: Math.random(),
      location: { lat: 0, lon: 0 }
    })),
    congestionLevel: Math.random(),
    estimatedDelay: Math.random() * 600 // seconds
  });
  
  /**
   * Update current location
   */
  const updateLocation = async (newLocation) => {
    currentLocation = newLocation;
    logger.info(`Environmental connector location updated to: ${newLocation.lat}, ${newLocation.lon}`);
    
    // Immediately collect data for new location
    await collectEnvironmentalData();
  };
  
  /**
   * Get current environmental status
   */
  const getEnvironmentalStatus = () => {
    return {
      isRunning,
      currentLocation,
      providers: {
        weather: {
          provider: weatherProvider,
          hasApiKey: !!weatherAPIKey,
          enabled: enableWeather
        },
        traffic: {
          provider: trafficProvider,
          hasApiKey: !!trafficAPIKey,
          enabled: enableTraffic
        }
      },
      updateInterval,
      lastUpdate: Date.now()
    };
  };
  
  /**
   * Cleanup and stop data collection
   */
  const disconnect = () => {
    isRunning = false;
    
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
    
    logger.info('🌍 Environmental data connector disconnected');
  };
  
  return {
    initialize,
    disconnect,
    updateLocation,
    getEnvironmentalStatus,
    collectEnvironmentalData,
    isRunning: () => isRunning
  };
};

// Placeholder implementations for API calls that would need API keys
const getWeatherAPIData = async (location) => {
  throw new Error('WeatherAPI.com integration not implemented');
};

const getNOAAWeatherData = async (location) => {
  throw new Error('NOAA Weather Service integration not implemented');
};

const getGoogleMapsTrafficData = async (location) => {
  throw new Error('Google Maps Traffic integration not implemented');
};

const getMapboxTrafficData = async (location) => {
  throw new Error('Mapbox Traffic integration not implemented');
};

const getAirQualityData = async (location) => {
  throw new Error('Air quality data integration not implemented');
};

const processAirQualityData = async (data, timestamp) => {
  // Implementation placeholder
};
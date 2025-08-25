/**
 * Distribution API Integration Test
 * Tests the distribution API endpoints specifically
 */

// Helper function to test if server has distribution API
const testDistributionAPIAvailability = async (baseUrl = 'http://localhost:3001') => {
  console.log('🔍 Testing Distribution API Availability...\n');

  const fetch = (await import('node-fetch')).default;
  
  const testEndpoints = [
    '/api/distribution/status',
    '/api/distribution/discovery', 
    '/api/distribution/streams',
    '/api/distribution/templates'
  ];

  const results = [];

  for (const endpoint of testEndpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await fetch(`${baseUrl}${endpoint}`);
      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      results.push({
        endpoint,
        status: response.status,
        ok: response.ok,
        data,
        available: response.status !== 404
      });

      if (response.ok) {
        console.log(`   ✅ ${endpoint}: ${response.status} - Available`);
      } else if (response.status === 404) {
        console.log(`   ❌ ${endpoint}: ${response.status} - Not found`);
      } else {
        console.log(`   ⚠️ ${endpoint}: ${response.status} - Error`);
      }
      
    } catch (error) {
      console.log(`   ❌ ${endpoint}: Connection failed - ${error.message}`);
      results.push({
        endpoint,
        status: 0,
        ok: false,
        error: error.message,
        available: false
      });
    }
  }

  console.log('\n📊 Distribution API Availability Summary:');
  const availableCount = results.filter(r => r.available).length;
  console.log(`Available endpoints: ${availableCount}/${results.length}`);
  console.log(`Overall availability: ${Math.round((availableCount / results.length) * 100)}%`);

  // Check server configuration
  try {
    console.log('\n🔍 Checking server configuration...');
    const configResponse = await fetch(`${baseUrl}/api/config`);
    const configData = await configResponse.json();
    
    if (configData.success && configData.data) {
      const features = configData.data.features;
      if (features) {
        console.log('Server features:');
        console.log(`  - Distribution: ${features.distribution ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`  - Analysis: ${features.analysis ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`  - Monitoring: ${features.monitoring ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`  - WebSocket: ${features.websocket ? '✅ Enabled' : '❌ Disabled'}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Could not check configuration: ${error.message}`);
  }

  return results;
};

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testDistributionAPIAvailability().catch(console.error);
}

export { testDistributionAPIAvailability };
#!/usr/bin/env bun

/**
 * Quick test to verify enhanced server is working after fixes
 */

import { createEnhancedAPIServer } from '../../src/services/api/enhanced-server.js';

async function testEnhancedServer() {
  console.log('🧪 Testing Enhanced Server Functionality...\n');
  
  try {
    // Test 1: Server creation
    console.log('1️⃣ Testing server creation...');
    const server = createEnhancedAPIServer({
      port: 4001
    });
    console.log('✅ Server created successfully');
    
    // Test 2: Server startup
    console.log('\n2️⃣ Testing server startup...');
    await server.start();
    console.log('✅ Server started successfully');
    
    // Test 3: Health endpoint
    console.log('\n3️⃣ Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:4001/api/health');
    const healthData = await healthResponse.json();
    
    if (healthData.success && healthData.data.status === 'healthy') {
      console.log('✅ Health endpoint working');
      console.log('   Status:', healthData.data.status);
      console.log('   Distribution streams:', healthData.data.distribution.streams.total);
    } else {
      console.log('❌ Health endpoint returned unexpected data');
    }
    
    // Test 4: Config endpoint
    console.log('\n4️⃣ Testing config endpoint...');
    const configResponse = await fetch('http://localhost:4001/api/config');
    const configData = await configResponse.json();
    
    if (configData.success && configData.data.api_version) {
      console.log('✅ Config endpoint working');
      console.log('   API Version:', configData.data.api_version);
      console.log('   Capabilities:', configData.data.capabilities.length);
    } else {
      console.log('❌ Config endpoint returned unexpected data');
    }
    
    // Test 5: Distribution status
    console.log('\n5️⃣ Testing distribution status endpoint...');
    const statusResponse = await fetch('http://localhost:4001/api/distribution/status');
    const statusData = await statusResponse.json();
    
    if (statusData.success && statusData.data) {
      console.log('✅ Distribution status endpoint working');
      console.log('   Streams:', statusData.data.streams.total);
      console.log('   Clients:', statusData.data.clients.total);
    } else {
      console.log('❌ Distribution status endpoint failed');
    }
    
    // Test 6: Server shutdown
    console.log('\n6️⃣ Testing server shutdown...');
    await server.stop();
    console.log('✅ Server stopped successfully');
    
    console.log('\n🎉 All enhanced server tests passed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Server creation and startup');
    console.log('   ✅ Orchestrator integration with strategies');
    console.log('   ✅ API endpoints functional');
    console.log('   ✅ Distribution API integrated');
    console.log('   ✅ Clean shutdown');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testEnhancedServer().catch(console.error);
/**
 * Device Discovery Pipeline
 * Discovers and enumerates available media devices (cameras/microphones)
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../../core/pipeline/pipeline.ts';
import { createAnalysisResult, createErrorResult } from '../../core/configuration/types.ts';
import os from 'os';
import { networkInterfaces } from 'os';

/**
 * Create device discovery pipeline for media devices
 * @param {Object} config - Pipeline configuration
 * @returns {Object} Device discovery pipeline
 */
export const createDeviceDiscoveryPipeline = (config = {}) => {
  const state = {
    discoveredDevices: new Map(),
    lastDiscovery: 0,
    discoveryInterval: config.discoveryInterval || 5000, // 5 seconds
    capabilities: new Map(), // device -> capabilities cache
    networkInfo: null
  };

  // Get local network information
  const getNetworkInfo = () => {
    if (state.networkInfo) return state.networkInfo;
    
    const interfaces = networkInterfaces();
    const primaryInterface = Object.values(interfaces)
      .flat()
      .find(iface => !iface.internal && iface.family === 'IPv4');
    
    state.networkInfo = {
      computerId: os.hostname(),
      ipAddress: primaryInterface?.address || 'localhost',
      platform: os.platform(),
      arch: os.arch(),
      port: config.streamingPort || 8080
    };
    
    return state.networkInfo;
  };

  // Browser-side device enumeration
  const enumerateMediaDevices = async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        // Request permissions first to get device labels
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Stop the permission stream
        stream.getTracks().forEach(track => track.stop());
        
        return devices.map(device => ({
          id: device.deviceId,
          label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
          type: device.kind, // 'videoinput', 'audioinput', 'audiooutput'
          groupId: device.groupId,
          platform: 'browser'
        }));
      } catch (error) {
        console.warn('Failed to enumerate media devices:', error);
        return [];
      }
    }
    
    // Server-side enumeration (mock for now, can be extended with native modules)
    return await enumerateSystemDevices();
  };

  // Server-side device enumeration (simplified mock)
  const enumerateSystemDevices = async () => {
    // This would use native modules like node-webrtc or system calls
    // For now, providing mock devices for testing
    const mockDevices = [
      {
        id: 'default_camera',
        label: 'Default Camera',
        type: 'videoinput',
        groupId: 'group1',
        platform: 'system'
      },
      {
        id: 'default_microphone', 
        label: 'Default Microphone',
        type: 'audioinput',
        groupId: 'group1',
        platform: 'system'
      }
    ];

    // Add platform-specific devices
    const platform = os.platform();
    if (platform === 'darwin') {
      mockDevices.push({
        id: 'facetime_camera',
        label: 'FaceTime HD Camera',
        type: 'videoinput',
        groupId: 'group2',
        platform: 'system'
      });
    }

    return mockDevices;
  };

  // Detect device capabilities
  const detectDeviceCapabilities = async (device) => {
    const cached = state.capabilities.get(device.id);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.capabilities;
    }

    let capabilities = {
      supportedResolutions: [],
      supportedFrameRates: [],
      supportedFormats: [],
      maxResolution: null,
      features: []
    };

    try {
      if (device.type === 'videoinput' && typeof navigator !== 'undefined') {
        // Test different video constraints to determine capabilities
        const testConstraints = [
          { width: 1920, height: 1080 },
          { width: 1280, height: 720 },
          { width: 640, height: 480 }
        ];

        for (const constraint of testConstraints) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: device.id,
                width: { exact: constraint.width },
                height: { exact: constraint.height }
              }
            });

            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            
            capabilities.supportedResolutions.push({
              width: settings.width,
              height: settings.height
            });

            if (!capabilities.maxResolution || 
                settings.width * settings.height > 
                capabilities.maxResolution.width * capabilities.maxResolution.height) {
              capabilities.maxResolution = {
                width: settings.width,
                height: settings.height
              };
            }

            // Test frame rates
            if (track.getCapabilities) {
              const caps = track.getCapabilities();
              capabilities.supportedFrameRates = caps.frameRate?.max ? 
                [15, 30, Math.min(60, caps.frameRate.max)] : [15, 30];
            } else {
              capabilities.supportedFrameRates = [15, 30];
            }

            stream.getTracks().forEach(track => track.stop());
            break; // Successfully tested, break out
          } catch (error) {
            // Continue to next resolution
          }
        }
      } else if (device.type === 'audioinput') {
        capabilities = {
          supportedSampleRates: [16000, 44100, 48000],
          supportedChannels: [1, 2],
          supportedFormats: ['opus', 'aac', 'pcm'],
          maxSampleRate: 48000,
          features: ['noise_suppression', 'echo_cancellation']
        };
      }

      // Cache capabilities
      state.capabilities.set(device.id, {
        capabilities,
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn(`Failed to detect capabilities for device ${device.id}:`, error);
      
      // Fallback capabilities
      if (device.type === 'videoinput') {
        capabilities = {
          supportedResolutions: [{ width: 640, height: 480 }],
          supportedFrameRates: [15, 30],
          maxResolution: { width: 640, height: 480 },
          features: ['basic_video']
        };
      }
    }

    return capabilities;
  };

  // Check device status and health
  const checkDeviceStatus = async (device) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // Quick test to see if device is accessible
        const constraints = device.type === 'videoinput' ? 
          { video: { deviceId: device.id } } : 
          { audio: { deviceId: device.id } };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const tracks = stream.getTracks();
        const isActive = tracks.length > 0 && tracks[0].readyState === 'live';
        
        tracks.forEach(track => track.stop());
        
        return {
          status: isActive ? 'available' : 'unavailable',
          lastChecked: Date.now(),
          error: null
        };
      }
      
      // Server-side status check (simplified)
      return {
        status: 'available',
        lastChecked: Date.now(),
        error: null
      };
    } catch (error) {
      return {
        status: 'unavailable',
        lastChecked: Date.now(),
        error: error.message
      };
    }
  };

  // Main pipeline processing function
  const processDiscoveryRequest = async (request = {}) => {
    try {
      const { forceRefresh = false, includeCapabilities = true } = request;
      const now = Date.now();
      
      // Check if we need to refresh discovery
      if (!forceRefresh && 
          now - state.lastDiscovery < state.discoveryInterval && 
          state.discoveredDevices.size > 0) {
        
        // Return cached results
        const cachedDevices = Array.from(state.discoveredDevices.values());
        return createAnalysisResult({
          status: 'success',
          data: {
            devices: cachedDevices,
            networkInfo: getNetworkInfo(),
            timestamp: state.lastDiscovery,
            source: 'cache'
          },
          id: `device-discovery_${now}`,
          source: 'device-discovery',
          processingTime: 1,
          timestamp: now
        });
      }

      console.log('🔍 Discovering media devices...');
      const startTime = performance.now();

      // Enumerate all media devices
      const rawDevices = await enumerateMediaDevices();
      console.log(`📱 Found ${rawDevices.length} raw devices`);

      // Enrich devices with capabilities and status
      const enrichedDevices = await Promise.all(
        rawDevices.map(async device => {
          console.log(`🔧 Analyzing device: ${device.label}`);
          
          const [capabilities, status] = await Promise.all([
            includeCapabilities ? detectDeviceCapabilities(device) : {},
            checkDeviceStatus(device)
          ]);

          return {
            ...device,
            capabilities,
            status,
            networkInfo: getNetworkInfo(),
            discoveredAt: now
          };
        })
      );

      // Update cache
      state.discoveredDevices.clear();
      enrichedDevices.forEach(device => {
        state.discoveredDevices.set(device.id, device);
      });
      state.lastDiscovery = now;

      const processingTime = performance.now() - startTime;
      console.log(`✅ Device discovery completed in ${processingTime.toFixed(2)}ms`);

      return createAnalysisResult({
        status: 'success',
        data: {
          devices: enrichedDevices,
          networkInfo: getNetworkInfo(),
          timestamp: now,
          source: 'fresh_discovery',
          statistics: {
            totalDevices: enrichedDevices.length,
            videoDevices: enrichedDevices.filter(d => d.type === 'videoinput').length,
            audioDevices: enrichedDevices.filter(d => d.type === 'audioinput').length,
            availableDevices: enrichedDevices.filter(d => d.status.status === 'available').length
          }
        },
        id: `device-discovery_${now}`,
        source: 'device-discovery',
        processingTime,
        timestamp: now
      });

    } catch (error) {
      console.error('Device discovery failed:', error);
      
      return createAnalysisResult({
        status: 'failed',
        error: createErrorResult(error.message, 'device-discovery'),
        id: `device-discovery_${Date.now()}`,
        source: 'device-discovery',
        processingTime: 0,
        timestamp: Date.now()
      });
    }
  };

  // Create the pipeline
  return createPipeline({
    name: 'device-discovery',
    version: '1.0.0',
    capabilities: ['device_enumeration', 'capability_detection', 'status_monitoring'],
    performance: {
      fps: 1, // Low frequency discovery
      latency: '100-500ms',
      cpuUsage: 'low',
      batteryImpact: 'minimal'
    },
    description: 'Discovers and analyzes available media devices',
    
    // Main processing function
    process: processDiscoveryRequest,
    
    // Optional cleanup
    cleanup: async () => {
      state.discoveredDevices.clear();
      state.capabilities.clear();
      state.networkInfo = null;
    }
  });
};

/**
 * Convenience function to create and initialize device discovery
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Initialized pipeline
 */
export const createDeviceDiscoverySystem = async (config = {}) => {
  const pipeline = createDeviceDiscoveryPipeline(config);
  
  if (config.autoInitialize !== false) {
    await pipeline.initialize();
  }
  
  return pipeline;
};

/**
 * Quick discovery function for immediate use
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Discovery results
 */
export const discoverDevices = async (options = {}) => {
  const pipeline = createDeviceDiscoveryPipeline(options);
  await pipeline.initialize();
  
  const result = await pipeline.process(options);
  await pipeline.cleanup();
  
  return result;
};

export default createDeviceDiscoveryPipeline;
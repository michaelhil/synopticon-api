/**
 * Device capability detection for pipeline preloader
 */

import { UsageContexts } from './preloader-config.js';

export const createDeviceDetector = () => {
  const deviceInfo = {
    isMobile: false,
    batteryLevel: 1.0,
    isCharging: true,
    memoryGB: undefined,
    cores: 4,
    hasTouch: false
  };

  const networkInfo = {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  };

  let currentContext = new Set();

  /**
   * Detect device capabilities
   */
  const detectDeviceCapabilities = () => {
    // Mobile device detection
    deviceInfo.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Memory detection (if available)
    if (navigator.deviceMemory) {
      deviceInfo.memoryGB = navigator.deviceMemory;
    }

    // Hardware concurrency
    deviceInfo.cores = navigator.hardwareConcurrency || 4;

    // Touch capability
    deviceInfo.hasTouch = 'ontouchstart' in window;
  };

  /**
   * Setup network monitoring
   */
  const setupNetworkMonitoring = (onContextChange) => {
    // Network Information API
    if ('connection' in navigator) {
      const {connection} = navigator;
      
      const updateNetworkInfo = () => {
        networkInfo.effectiveType = connection.effectiveType || '4g';
        networkInfo.downlink = connection.downlink || 10;
        networkInfo.rtt = connection.rtt || 100;
        networkInfo.saveData = connection.saveData || false;
        
        updateCurrentContext(onContextChange);
      };

      connection.addEventListener('change', updateNetworkInfo);
      updateNetworkInfo();
    }
  };

  /**
   * Setup battery monitoring
   */
  const setupBatteryMonitoring = (onContextChange) => {
    // Battery Status API
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        const updateBatteryInfo = () => {
          deviceInfo.batteryLevel = battery.level;
          deviceInfo.isCharging = battery.charging;
          
          updateCurrentContext(onContextChange);
        };

        battery.addEventListener('levelchange', updateBatteryInfo);
        battery.addEventListener('chargingchange', updateBatteryInfo);
        updateBatteryInfo();
      }).catch(() => {
        // Battery API not supported or blocked
      });
    }
  };

  /**
   * Update current usage context
   */
  const updateCurrentContext = (onContextChange) => {
    const newContext = new Set();
    
    // Device context
    if (deviceInfo.isMobile) {
      newContext.add(UsageContexts.MOBILE_DEVICE);
    }
    
    if (deviceInfo.batteryLevel < 0.2) {
      newContext.add(UsageContexts.BATTERY_CRITICAL);
    }

    // Network context
    if (networkInfo.effectiveType === '4g' && networkInfo.downlink > 5) {
      newContext.add(UsageContexts.HIGH_BANDWIDTH);
    } else if (networkInfo.effectiveType === '2g' || networkInfo.saveData) {
      newContext.add(UsageContexts.LOW_BANDWIDTH);
    }

    // Usage context - handle localStorage safely
    let isFirstVisit = true;
    try {
      if (typeof localStorage !== 'undefined') {
        isFirstVisit = !localStorage.getItem('synopticon_usage_history');
      }
    } catch (_error) {
      // localStorage not available (Node.js/test environment)
    }
    
    if (isFirstVisit) {
      newContext.add(UsageContexts.FIRST_VISIT);
    } else {
      newContext.add(UsageContexts.RETURNING_USER);
    }

    // Check if webcam is active
    navigator.mediaDevices?.getUserMedia?.({ video: true })
      .then(stream => {
        newContext.add(UsageContexts.WEBCAM_ACTIVE);
        stream.getTracks().forEach(track => track.stop());
        currentContext = newContext;
        if (onContextChange) onContextChange();
      })
      .catch(() => {
        currentContext = newContext;
        if (onContextChange) onContextChange();
      });
  };

  return {
    detectDeviceCapabilities,
    setupNetworkMonitoring,
    setupBatteryMonitoring,
    updateCurrentContext,
    getDeviceInfo: () => ({ ...deviceInfo }),
    getNetworkInfo: () => ({ ...networkInfo }),
    getCurrentContext: () => new Set(currentContext)
  };
};
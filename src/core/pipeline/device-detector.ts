/**
 * Device capability detection for pipeline preloader
 */

import { UsageContexts } from './preloader-config.js'

export interface DeviceInfo {
  isMobile: boolean;
  batteryLevel: number;
  isCharging: boolean;
  memoryGB?: number;
  cores: number;
  hasTouch: boolean;
}

export interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface NetworkConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener: (type: string, callback: () => void) => void;
}

export interface BatteryManager {
  level: number;
  charging: boolean;
  addEventListener: (type: string, callback: () => void) => void;
}

export interface NavigatorWithExtensions extends Navigator {
  connection?: NetworkConnection;
  deviceMemory?: number;
  getBattery?: () => Promise<BatteryManager>;
}

export interface DeviceDetector {
  detectDeviceCapabilities: () => void;
  setupNetworkMonitoring: (onContextChange?: () => void) => void;
  setupBatteryMonitoring: (onContextChange?: () => void) => void;
  updateCurrentContext: (onContextChange?: () => void) => void;
  getDeviceInfo: () => DeviceInfo;
  getNetworkInfo: () => NetworkInfo;
  getCurrentContext: () => Set<string>;
}

export const createDeviceDetector = (): DeviceDetector => {
  const deviceInfo: DeviceInfo = {
    isMobile: false,
    batteryLevel: 1.0,
    isCharging: true,
    memoryGB: undefined,
    cores: 4,
    hasTouch: false
  };

  const networkInfo: NetworkInfo = {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  };

  let currentContext = new Set<string>();

  /**
   * Detect device capabilities
   */
  const detectDeviceCapabilities = (): void => {
    // Mobile device detection
    if (typeof navigator !== 'undefined') {
      deviceInfo.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      // Memory detection (if available)
      const extendedNavigator = navigator as NavigatorWithExtensions;
      if (extendedNavigator.deviceMemory) {
        deviceInfo.memoryGB = extendedNavigator.deviceMemory;
      }

      // Hardware concurrency
      deviceInfo.cores = navigator.hardwareConcurrency || 4;

      // Touch capability
      if (typeof window !== 'undefined') {
        deviceInfo.hasTouch = 'ontouchstart' in window;
      }
    }
  };

  /**
   * Setup network monitoring
   */
  const setupNetworkMonitoring = (onContextChange?: () => void): void => {
    // Network Information API
    if (typeof navigator !== 'undefined') {
      const extendedNavigator = navigator as NavigatorWithExtensions;
      if (extendedNavigator.connection) {
        const connection = extendedNavigator.connection;
        
        const updateNetworkInfo = (): void => {
          networkInfo.effectiveType = connection.effectiveType || '4g';
          networkInfo.downlink = connection.downlink || 10;
          networkInfo.rtt = connection.rtt || 100;
          networkInfo.saveData = connection.saveData || false;
          
          updateCurrentContext(onContextChange);
        };

        connection.addEventListener('change', updateNetworkInfo);
        updateNetworkInfo();
      }
    }
  };

  /**
   * Setup battery monitoring
   */
  const setupBatteryMonitoring = (onContextChange?: () => void): void => {
    // Battery Status API
    if (typeof navigator !== 'undefined') {
      const extendedNavigator = navigator as NavigatorWithExtensions;
      if (extendedNavigator.getBattery) {
        extendedNavigator.getBattery().then(battery => {
          const updateBatteryInfo = (): void => {
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
    }
  };

  /**
   * Update current usage context
   */
  const updateCurrentContext = (onContextChange?: () => void): void => {
    const newContext = new Set<string>();
    
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
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
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
    } else {
      currentContext = newContext;
      if (onContextChange) onContextChange();
    }
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
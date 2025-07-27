// Performance optimization utilities for mobile networks

export interface NetworkInfo {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private networkInfo: NetworkInfo | null = null;
  private observers: ((info: NetworkInfo) => void)[] = [];

  private constructor() {
    this.initNetworkMonitoring();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  private initNetworkMonitoring() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      this.updateNetworkInfo(connection);
      
      connection.addEventListener('change', () => {
        this.updateNetworkInfo(connection);
      });
    }
  }

  private updateNetworkInfo(connection: any) {
    this.networkInfo = {
      effectiveType: connection.effectiveType || '4g',
      downlink: connection.downlink || 10,
      rtt: connection.rtt || 100,
      saveData: connection.saveData || false,
    };

    this.observers.forEach(observer => observer(this.networkInfo!));
  }

  public getNetworkInfo(): NetworkInfo | null {
    return this.networkInfo;
  }

  public onNetworkChange(callback: (info: NetworkInfo) => void) {
    this.observers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  public isSlowNetwork(): boolean {
    if (!this.networkInfo) return false;
    
    return (
      this.networkInfo.effectiveType === '2g' ||
      this.networkInfo.effectiveType === 'slow-2g' ||
      this.networkInfo.downlink < 1.5 ||
      this.networkInfo.rtt > 300
    );
  }

  public shouldReduceQuality(): boolean {
    return this.isSlowNetwork() || (this.networkInfo?.saveData ?? false);
  }

  public getOptimalImageQuality(): number {
    if (!this.networkInfo) return 0.8;
    
    if (this.networkInfo.saveData) return 0.4;
    
    switch (this.networkInfo.effectiveType) {
      case 'slow-2g':
        return 0.3;
      case '2g':
        return 0.4;
      case '3g':
        return 0.6;
      case '4g':
      default:
        return 0.8;
    }
  }

  public getOptimalPageSize(): number {
    if (!this.networkInfo) return 20;
    
    if (this.networkInfo.saveData) return 5;
    
    switch (this.networkInfo.effectiveType) {
      case 'slow-2g':
        return 5;
      case '2g':
        return 10;
      case '3g':
        return 15;
      case '4g':
      default:
        return 20;
    }
  }

  public shouldPreloadData(): boolean {
    return !this.isSlowNetwork() && !this.networkInfo?.saveData;
  }
}

// Image optimization utilities
export class ImageOptimizer {
  public static resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality: number = 0.8
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  public static async optimizeForNetwork(file: File): Promise<Blob> {
    const optimizer = PerformanceOptimizer.getInstance();
    const quality = optimizer.getOptimalImageQuality();
    
    // Determine optimal dimensions based on network
    let maxWidth = 1920;
    let maxHeight = 1080;
    
    if (optimizer.isSlowNetwork()) {
      maxWidth = 800;
      maxHeight = 600;
    } else if (optimizer.shouldReduceQuality()) {
      maxWidth = 1200;
      maxHeight = 800;
    }

    return this.resizeImage(file, maxWidth, maxHeight, quality);
  }
}

// Data loading optimization
export class DataLoader {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  public static async loadWithCache<T>(
    key: string,
    loader: () => Promise<T>,
    ttl: number = 300000 // 5 minutes default
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const data = await loader();
    this.cache.set(key, { data, timestamp: now, ttl });
    
    return data;
  }

  public static clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  public static async loadInBatches<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
    delay: number = 100
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);
      
      // Add delay between batches to prevent overwhelming the system
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// Lazy loading utilities
export class LazyLoader {
  private static observer: IntersectionObserver | null = null;
  private static callbacks = new Map<Element, () => void>();

  public static init() {
    if (this.observer) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.callbacks.get(entry.target);
            if (callback) {
              callback();
              this.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );
  }

  public static observe(element: Element, callback: () => void) {
    this.init();
    
    if (this.observer) {
      this.callbacks.set(element, callback);
      this.observer.observe(element);
    }
  }

  public static unobserve(element: Element) {
    if (this.observer) {
      this.observer.unobserve(element);
      this.callbacks.delete(element);
    }
  }

  public static disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.callbacks.clear();
      this.observer = null;
    }
  }
}

// Memory management
export class MemoryManager {
  private static memoryWarningThreshold = 50 * 1024 * 1024; // 50MB

  public static getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  public static isMemoryPressure(): boolean {
    const usage = this.getMemoryUsage();
    return usage > this.memoryWarningThreshold;
  }

  public static cleanup() {
    // Clear caches
    DataLoader.clearCache();
    LazyLoader.disconnect();
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
  }

  public static monitorMemory(callback: (usage: number) => void) {
    const check = () => {
      const usage = this.getMemoryUsage();
      callback(usage);
      
      if (this.isMemoryPressure()) {
        this.cleanup();
      }
    };

    // Check every 30 seconds
    const interval = setInterval(check, 30000);
    
    // Return cleanup function
    return () => clearInterval(interval);
  }
}

// Battery optimization
export class BatteryOptimizer {
  private static batteryInfo: any = null;

  public static async init() {
    if ('getBattery' in navigator) {
      try {
        this.batteryInfo = await (navigator as any).getBattery();
      } catch (error) {
        console.warn('Battery API not available:', error);
      }
    }
  }

  public static isLowBattery(): boolean {
    if (!this.batteryInfo) return false;
    return this.batteryInfo.level < 0.2; // Less than 20%
  }

  public static isBatteryCharging(): boolean {
    if (!this.batteryInfo) return true; // Assume charging if unknown
    return this.batteryInfo.charging;
  }

  public static shouldReduceActivity(): boolean {
    return this.isLowBattery() && !this.isBatteryCharging();
  }

  public static getOptimalUpdateInterval(): number {
    if (this.shouldReduceActivity()) {
      return 10000; // 10 seconds
    } else if (this.isLowBattery()) {
      return 5000; // 5 seconds
    }
    return 1000; // 1 second
  }
}

// Export singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance();
import { useEffect, useRef } from "react";

interface PerformanceMetrics {
  screenName: string;
  renderTime: number;
  animationFPS: number;
  memoryUsage: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isEnabled: boolean = __DEV__; // Only track in dev mode
  private readonly maxMetrics = 100; // Keep last 100 metrics

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  recordMetric(metric: PerformanceMetrics) {
    if (!this.isEnabled) return;

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log if performance degraded
    if (metric.animationFPS < 55) {
      console.warn(
        `⚠️ Low FPS detected on ${metric.screenName}: ${metric.animationFPS.toFixed(1)} FPS`
      );
    }
  }

  getMetrics(screenName?: string) {
    if (!screenName) return this.metrics;
    return this.metrics.filter((m) => m.screenName === screenName);
  }

  getAverageMetrics(screenName?: string) {
    const relevantMetrics = this.getMetrics(screenName);
    if (relevantMetrics.length === 0) return null;

    const avg = relevantMetrics.reduce(
      (acc, m) => ({
        screenName: screenName || "overall",
        renderTime: acc.renderTime + m.renderTime,
        animationFPS: acc.animationFPS + m.animationFPS,
        memoryUsage: acc.memoryUsage + m.memoryUsage,
        timestamp: 0,
      }),
      { screenName: screenName || "overall", renderTime: 0, animationFPS: 0, memoryUsage: 0, timestamp: 0 }
    );

    return {
      ...avg,
      renderTime: avg.renderTime / relevantMetrics.length,
      animationFPS: avg.animationFPS / relevantMetrics.length,
      memoryUsage: avg.memoryUsage / relevantMetrics.length,
    };
  }

  clear() {
    this.metrics = [];
  }

  report() {
    if (!this.isEnabled) return;

    console.log("\n📊 Performance Report:");
    console.log("=".repeat(50));

    const screenNames = [...new Set(this.metrics.map((m) => m.screenName))];
    screenNames.forEach((name) => {
      const avg = this.getAverageMetrics(name);
      if (avg) {
        console.log(`\n📱 ${name}:`);
        console.log(`   Avg Render Time: ${avg.renderTime.toFixed(2)}ms`);
        console.log(`   Avg Animation FPS: ${avg.animationFPS.toFixed(1)} FPS`);
        console.log(`   Avg Memory: ${(avg.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }
    });
    console.log("\n" + "=".repeat(50));
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook to monitor screen render performance
 */
export function usePerformanceMonitor(screenName: string) {
  const renderStartRef = useRef(Date.now());

  useEffect(() => {
    const renderTime = Date.now() - renderStartRef.current;

    // Estimate FPS (simplified - in production use more sophisticated method)
    const estimatedFPS = 60; // Default to 60 FPS on successful render

    // Get memory usage (if available - only in some environments)
    let memoryUsage = 0;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      memoryUsage = ((performance as any).memory).usedJSHeapSize || 0;
    }

    performanceMonitor.recordMetric({
      screenName,
      renderTime,
      animationFPS: estimatedFPS,
      memoryUsage,
      timestamp: Date.now(),
    });
  }, [screenName]);

  return {
    recordAction: (actionName: string, duration: number) => {
      if (__DEV__) {
        console.log(`⏱️ ${actionName}: ${duration.toFixed(2)}ms on ${screenName}`);
      }
    },
    reportMetrics: () => {
      performanceMonitor.report();
    },
  };
}

/**
 * Time an async operation
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    if (__DEV__) {
      console.log(`✅ ${label}: ${duration.toFixed(2)}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${label}: ${duration.toFixed(2)}ms - ${error}`);
    throw error;
  }
}

/**
 * Time a sync operation
 */
export function measure<T>(label: string, fn: () => T): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    if (__DEV__) {
      console.log(`✅ ${label}: ${duration.toFixed(2)}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${label}: ${duration.toFixed(2)}ms - ${error}`);
    throw error;
  }
}

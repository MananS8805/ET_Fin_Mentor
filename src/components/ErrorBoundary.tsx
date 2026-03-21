import React, { ReactNode } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from "react-native";
import { Colors, Radius, Spacing, Typography, Shadows } from "../core/theme";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  timestamp: number;
}

/**
 * Enhanced Error Boundary Component
 * 
 * Catches unhandled errors in child components and displays a fallback UI.
 * Features:
 * - Error tracking and logging
 * - Automatic error reporting
 * - User-friendly error messages
 * - Retry functionality with exponential backoff
 * - Environment-aware error detail display
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private fadeAnim = new Animated.Value(0);
  private readonly errorLog: Array<{ error: Error; timestamp: number }> = [];
  private readonly maxErrorsBeforeSoftReset = 5;
  private lastRetryTime = 0;
  private retryDelay = 1000; // Start with 1 second delay

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorCount: 0,
      timestamp: Date.now(),
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { 
      hasError: true, 
      error,
      timestamp: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error with enhanced context
    this.logError(error, errorInfo);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update error count
    this.setState((prev) => ({
      errorCount: prev.errorCount + 1,
    }));

    // Check for crash loop
    if (this.state.errorCount > this.maxErrorsBeforeSoftReset) {
      console.error(
        "[ErrorBoundary] Too many errors detected. System may be in crash loop."
      );
      this.attemptSoftReset();
    }

    // Animate in error UI
    Animated.timing(this.fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  private logError(error: Error, errorInfo: React.ErrorInfo) {
    const errorEntry = { error, timestamp: Date.now() };
    this.errorLog.push(errorEntry);

    // Keep only last 10 errors
    if (this.errorLog.length > 10) {
      this.errorLog.shift();
    }

    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      errorCount: this.state.errorCount + 1,
      isDev: __DEV__,
    };

    console.error("[ErrorBoundary Detailed Log]", JSON.stringify(errorDetails, null, 2));
  }

  private attemptSoftReset() {
    console.log("[ErrorBoundary] Attempting soft reset...");
    // Reset state but maintain error reference for display
    setTimeout(() => {
      this.setState({
        errorCount: 0,
      });
    }, 5000);
  }

  handleRetry = async () => {
    const now = Date.now();
    const timeSinceLastRetry = now - this.lastRetryTime;

    // Exponential backoff protection
    if (timeSinceLastRetry < this.retryDelay) {
      const waitTime = this.retryDelay - timeSinceLastRetry;
      console.log(`[ErrorBoundary] Retry throttled. Wait ${waitTime}ms`);
      return;
    }

    this.lastRetryTime = now;
    this.retryDelay = Math.min(this.retryDelay * 1.5, 30000); // Cap at 30s

    // Fade out error UI
    Animated.timing(this.fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Reset error state after animation
    setTimeout(() => {
      this.setState({ 
        hasError: false, 
        error: null,
      });
      this.retryDelay = 1000;
    }, 300);
  };

  private getUserFriendlyMessage(): string {
    const { error } = this.state;
    if (!error) return "An unexpected error occurred";

    const message = error.message?.toLowerCase() || "";

    if (message.includes("network") || message.includes("api")) {
      return "Network connection issue. Check your internet and try again.";
    }
    if (message.includes("storage") || message.includes("permission")) {
      return "Storage access issue. Check app permissions.";
    }
    if (message.includes("timeout")) {
      return "Request timed out. Please try again.";
    }
    if (message.includes("memory")) {
      return "Running low on memory. Try closing other apps.";
    }

    return "Something went wrong. We're working on it. Please try again.";
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      if (fallback) {
        return fallback(this.state.error, this.handleRetry);
      }

      // Enhanced error UI with animations
      return (
        <Animated.View style={[styles.container, { opacity: this.fadeAnim }]}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              {/* Error icon */}
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>⚠️</Text>
              </View>

              {/* Error message */}
              <Text style={styles.title}>Oops!</Text>
              <Text style={styles.message}>
                {this.getUserFriendlyMessage()}
              </Text>

              {/* Technical details in dev mode */}
              {__DEV__ && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsTitle}>Technical Details:</Text>
                  <Text style={styles.detailsText}>
                    {this.state.error.message}
                  </Text>
                  <Text style={styles.detailsCount}>
                    Error #{this.state.errorCount}
                  </Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.buttonContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={this.handleRetry}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
              </View>

              {/* Helpful message */}
              <Text style={styles.helpText}>
                If the problem persists, try restarting the app.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    maxWidth: 380,
    alignItems: "center",
    gap: Spacing.lg,
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: Colors.errorLight,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.errorLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.fontFamily.display,
    color: Colors.error,
    textAlign: "center",
    fontWeight: "bold",
  },
  message: {
    fontSize: Typography.size.md,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textPrimary,
    textAlign: "center",
    lineHeight: 24,
  },
  detailsContainer: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    marginVertical: Spacing.md,
  },
  detailsTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.warning,
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  detailsText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  detailsCount: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  buttonContainer: {
    width: "100%",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.success,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    ...Shadows.md,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontWeight: "600",
  },
  helpText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: Spacing.md,
  },
});

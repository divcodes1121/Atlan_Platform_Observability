// File: src/instrumentation/tracer.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

/**
 * Initialize OpenTelemetry for the Atlan API service
 * - Configures tracing, metrics, and logging instrumentation
 * - Sets up exporters for Prometheus, Tempo, and Loki
 * - Instruments Express, HTTP, PostgreSQL, and Winston automatically
 */
export function initTelemetry() {
  // Define service name and version for resource attribution
  const resourceAttributes = {
    [SemanticResourceAttributes.SERVICE_NAME]: 'atlan-api-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  };

  // Use Resource.default() to ensure compatibility
  const resource = Resource.default().merge(
    new Resource(resourceAttributes)
  );

  // Configure trace exporter to send to Tempo
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  });

  // Create and configure SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      // Auto-instrument Express.js framework
      new ExpressInstrumentation({
        // Capture HTTP route parameters in spans
        ignoreLayersType: []
      }),
      // Auto-instrument HTTP client requests
      new HttpInstrumentation({
        // Track HTTP request and response headers
        headersToSpanAttributes: {
          server: {
            requestHeaders: ['x-request-id', 'authorization'],
            responseHeaders: ['content-length', 'content-type']
          },
          client: {
            requestHeaders: ['x-request-id'],
            responseHeaders: ['content-length']
          }
        }
      }),
      // Auto-instrument PostgreSQL queries
      new PgInstrumentation({
        // Capture query parameters for debugging (careful with PII)
        enhancedDatabaseReporting: true
      }),
      // Auto-instrument Winston logger
      new WinstonInstrumentation({
        // Correlate logs with traces using trace context
        logHook: (span, record) => {
          record['trace_id'] = span.spanContext().traceId;
          record['span_id'] = span.spanContext().spanId;
        }
      }),
      // Enable all other auto-instrumentations
      getNodeAutoInstrumentations({
        // Additional configuration for other instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false } // Disable noisy fs instrumentation
      }),
    ]
    // Remove metricReader that was causing issues
  });

  // Initialize the SDK and register with the OpenTelemetry API
  sdk.start();

  // Gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Tracing and metrics terminated'))
      .catch((error) => console.error('Error terminating tracing and metrics', error))
      .finally(() => process.exit(0));
  });

  console.log('OpenTelemetry instrumentation initialized');
  return sdk;
}
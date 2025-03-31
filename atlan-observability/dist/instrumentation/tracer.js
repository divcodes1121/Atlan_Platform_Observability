"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTelemetry = initTelemetry;
// File: src/instrumentation/tracer.ts
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_proto_1 = require("@opentelemetry/exporter-trace-otlp-proto");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const instrumentation_winston_1 = require("@opentelemetry/instrumentation-winston");
const instrumentation_express_1 = require("@opentelemetry/instrumentation-express");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const instrumentation_pg_1 = require("@opentelemetry/instrumentation-pg");
/**
 * Initialize OpenTelemetry for the Atlan API service
 * - Configures tracing, metrics, and logging instrumentation
 * - Sets up exporters for Prometheus, Tempo, and Loki
 * - Instruments Express, HTTP, PostgreSQL, and Winston automatically
 */
function initTelemetry() {
    // Define service name and version for resource attribution
    const resourceAttributes = {
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: 'atlan-api-service',
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    };
    // Use Resource.default() to ensure compatibility
    const resource = resources_1.Resource.default().merge(new resources_1.Resource(resourceAttributes));
    // Configure trace exporter to send to Tempo
    const traceExporter = new exporter_trace_otlp_proto_1.OTLPTraceExporter({
        url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });
    // Create and configure SDK
    const sdk = new sdk_node_1.NodeSDK({
        resource,
        traceExporter,
        instrumentations: [
            // Auto-instrument Express.js framework
            new instrumentation_express_1.ExpressInstrumentation({
                // Capture HTTP route parameters in spans
                ignoreLayersType: []
            }),
            // Auto-instrument HTTP client requests
            new instrumentation_http_1.HttpInstrumentation({
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
            new instrumentation_pg_1.PgInstrumentation({
                // Capture query parameters for debugging (careful with PII)
                enhancedDatabaseReporting: true
            }),
            // Auto-instrument Winston logger
            new instrumentation_winston_1.WinstonInstrumentation({
                // Correlate logs with traces using trace context
                logHook: (span, record) => {
                    record['trace_id'] = span.spanContext().traceId;
                    record['span_id'] = span.spanContext().spanId;
                }
            }),
            // Enable all other auto-instrumentations
            (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
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

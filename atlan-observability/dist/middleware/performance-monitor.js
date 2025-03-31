"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMonitor = performanceMonitor;
const api_1 = require("@opentelemetry/api");
const uuid_1 = require("uuid");
// Create a tracer for this module
const tracer = api_1.trace.getTracer('api-performance-monitor');
/**
 * Middleware to monitor API endpoint performance and gather detailed metrics
 * - Response time
 * - Error rates
 * - Request/response payload sizes
 * - User and tenant context
 */
function performanceMonitor() {
    return (req, res, next) => {
        // Generate unique request ID if not present
        const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
        req.headers['x-request-id'] = requestId;
        // Extract important business context
        const userId = req.headers['x-user-id'] || 'anonymous';
        const tenantId = req.headers['x-tenant-id'] || 'unknown';
        // Capture request start time
        const startTime = performance.now();
        // Track request payload size
        const requestSize = req.headers['content-length'] ?
            parseInt(req.headers['content-length'], 10) : 0;
        // Create a custom span for enhanced API monitoring
        tracer.startActiveSpan(`API ${req.method} ${req.path}`, {
            kind: api_1.SpanKind.SERVER,
            attributes: {
                'http.request_id': requestId,
                'http.method': req.method,
                'http.route': req.path,
                'http.user_agent': req.headers['user-agent'],
                'business.user_id': userId,
                'business.tenant_id': tenantId,
                'request.size_bytes': requestSize,
            }
        }, (span) => {
            // Track original response methods
            const originalJson = res.json;
            const originalSend = res.send;
            const originalEnd = res.end;
            let responseSize = 0;
            // Intercept and measure response JSON size
            res.json = function (body) {
                try {
                    const bodyString = JSON.stringify(body);
                    responseSize = bodyString.length;
                    span.setAttribute('response.size_bytes', responseSize);
                    return originalJson.call(this, body);
                }
                catch (error) {
                    console.error('Error calculating response size:', error);
                    return originalJson.call(this, body);
                }
            };
            // Override send to track response size for non-JSON responses
            res.send = function (body) {
                try {
                    if (body && typeof body !== 'object') {
                        responseSize = Buffer.byteLength(String(body));
                        span.setAttribute('response.size_bytes', responseSize);
                    }
                    return originalSend.call(this, body);
                }
                catch (error) {
                    console.error('Error in response interception:', error);
                    return originalSend.call(this, body);
                }
            };
            // Use a simple approach to capture the response metrics
            // without modifying res.end directly
            const responseFinishHandler = () => {
                // Calculate API response time
                const responseTime = performance.now() - startTime;
                // Record response status
                span.setAttribute('http.status_code', res.statusCode);
                span.setAttribute('http.response_time_ms', responseTime);
                // Tag errors appropriately
                if (res.statusCode >= 400) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: `HTTP Error ${res.statusCode}`
                    });
                    // Add error attributes for filtering
                    span.setAttribute('error', true);
                    span.setAttribute('error.type', res.statusCode >= 500 ? 'server_error' : 'client_error');
                }
                // Log completion with key performance data
                console.log(`[${requestId}] ${req.method} ${req.path} completed in ${responseTime.toFixed(2)}ms with status ${res.statusCode}`);
                // End the performance span
                span.end();
            };
            // Listen for the finish event instead of overriding res.end
            res.on('finish', responseFinishHandler);
            // Continue to the next middleware
            next();
        });
    };
}

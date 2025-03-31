"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// File: src/api/index.ts
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const axios_1 = __importDefault(require("axios"));
const winston_1 = __importDefault(require("winston"));
const tracer_1 = require("../instrumentation/tracer");
const performance_monitor_1 = require("../middleware/performance-monitor");
const promClient = __importStar(require("prom-client"));
// Initialize OpenTelemetry - MUST be called before other imports
(0, tracer_1.initTelemetry)();
// Create Express app
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Configure structured logger
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    defaultMeta: { service: 'atlan-api-service' },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        })
    ]
});
// Initialize Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'api_' });
// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['route', 'method', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});
const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['route', 'method']
});
const httpRequestErrorsTotal = new promClient.Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP request errors',
    labelNames: ['route', 'method', 'status']
});
// Add metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});
// Initialize DB connection pool
const dbPool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'atlan',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});
// Apply performance monitoring middleware to all routes
app.use((0, performance_monitor_1.performanceMonitor)());
// Health check endpoint
app.get('/health', (req, res) => {
    // Increment request counter
    httpRequestsTotal.inc({ route: '/health', method: req.method });
    const end = httpRequestDurationMicroseconds.startTimer();
    res.status(200).json({ status: 'ok' });
    end({ route: '/health', method: req.method, status: 200 });
});
// Example API endpoint that demonstrates a complex operation
app.get('/api/users/:userId/data', async (req, res) => {
    const { userId } = req.params;
    const route = '/api/users/:userId/data';
    // Increment request counter
    httpRequestsTotal.inc({ route, method: req.method });
    const end = httpRequestDurationMicroseconds.startTimer();
    try {
        logger.info(`Fetching user data for user ${userId}`);
        // Phase 1: Database Query for User Info
        const userResult = await dbPool.query('SELECT id, name, email, tenant_id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            logger.warn(`User ${userId} not found`);
            httpRequestErrorsTotal.inc({ route, method: req.method, status: 404 });
            end({ route, method: req.method, status: 404 });
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        // Phase 2: Get External Authentication Status
        const authResponse = await axios_1.default.get(`${process.env.AUTH_SERVICE_URL || 'http://auth-service:8080'}/verify/${userId}`, { timeout: 2000 });
        if (!authResponse.data.verified) {
            logger.warn(`Authentication failed for user ${userId}`);
            httpRequestErrorsTotal.inc({ route, method: req.method, status: 401 });
            end({ route, method: req.method, status: 401 });
            return res.status(401).json({ error: 'Authentication failed' });
        }
        // Phase 3: Query User's Data Records from Database
        const dataResult = await dbPool.query('SELECT id, record_type, created_at, data FROM user_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
        // Phase 4: Fetch User Analytics from Analytics Service
        let analytics = null;
        try {
            const analyticsResponse = await axios_1.default.get(`${process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8080'}/user/${userId}/stats`, { timeout: 3000 });
            analytics = analyticsResponse.data;
        }
        catch (analyticsError) {
            // Log but don't fail - analytics are non-critical
            logger.warn(`Failed to fetch analytics for user ${userId}`, {
                error: analyticsError?.message || 'Unknown analytics error'
            });
        }
        // Assemble and return the complete response
        const response = {
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            data: dataResult.rows,
            analytics,
            meta: {
                recordCount: dataResult.rowCount,
                timestamp: new Date().toISOString()
            }
        };
        logger.info(`Successfully retrieved data for user ${userId}`);
        end({ route, method: req.method, status: 200 });
        res.status(200).json(response);
    }
    catch (error) {
        // Properly log the error with context
        logger.error(`Error processing request for user ${userId}`, {
            error: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            userId
        });
        // Increment error counter
        httpRequestErrorsTotal.inc({ route, method: req.method, status: 500 });
        // Record response time with error status
        end({ route, method: req.method, status: 500 });
        // Provide appropriate error response
        res.status(500).json({
            error: 'Failed to process request',
            requestId: req.headers['x-request-id']
        });
    }
});
// Add a mock API endpoint that simulates a database
app.get('/api/demo/metrics', (req, res) => {
    const route = '/api/demo/metrics';
    httpRequestsTotal.inc({ route, method: req.method });
    const end = httpRequestDurationMicroseconds.startTimer();
    // Create demo response with some sample metrics
    const response = {
        status: "success",
        data: {
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            metrics: [
                { name: "api_response_time", value: Math.random() * 200 + 50 },
                { name: "api_error_rate", value: Math.random() * 0.05 },
                { name: "api_requests_per_minute", value: Math.floor(Math.random() * 500) }
            ]
        }
    };
    // Add slight delay to simulate processing
    setTimeout(() => {
        end({ route, method: req.method, status: 200 });
        res.status(200).json(response);
    }, Math.random() * 100);
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`API server started on port ${PORT}`);
});
exports.default = app;

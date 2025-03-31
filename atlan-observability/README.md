Atlan Observability Platform
A comprehensive observability solution designed to address debugging challenges faced by engineering teams at Atlan.
Project Overview
This project implements a complete observability stack that provides metrics, logs, and distributed tracing for API services. It enables engineers to quickly identify and diagnose performance issues without relying on a few experienced team members.
Key features:

API instrumentation using OpenTelemetry
Custom performance monitoring middleware
Complete observability pipeline (collection, storage, visualization)
Unified dashboards for correlating metrics, logs, and traces
Self-service debugging capabilities for all engineers

Architecture
Show Image
The solution is built on a four-layer architecture:

Instrumentation Layer: Automatically captures telemetry data from API services
Collection Layer: Processes and routes telemetry data to specialized backends
Storage Layer: Stores metrics, logs, and traces in purpose-built databases
Visualization Layer: Provides unified dashboards and alerting

Data Model
Show Image
The data model shows how different telemetry types are correlated through common identifiers, enabling engineers to navigate from high-level metrics to detailed traces.
Technologies Used

API Service: Node.js with Express
Instrumentation: OpenTelemetry, Winston
Metrics: Prometheus
Logs: Loki
Traces: Tempo
Visualization: Grafana
Infrastructure: Docker, Docker Compose

Getting Started
Prerequisites

Node.js (v14+)
Docker and Docker Compose
Git

Installation

Clone the repository:
bashCopygit clone https://github.com/your-username/atlan-observability.git
cd atlan-observability

Install dependencies:
bashCopynpm install

Build the TypeScript code:
bashCopynpm run build

Start the observability stack:
bashCopydocker-compose up -d

Check that all services are running:
bashCopydocker-compose ps


Accessing the Services

API Service: http://localhost:3000
Grafana: http://localhost:3001 (username: admin, password: admin)
Prometheus: http://localhost:9090

Generating Sample Data
To generate traffic and populate the dashboards:
bashCopy# Run multiple requests to generate metrics
for i in {1..50}; do 
  curl http://localhost:3000/health
  sleep 0.2
  curl http://localhost:3000/api/demo/metrics
  sleep 0.2
done
API Documentation
The API service includes these endpoints:

GET /health: Simple health check endpoint
GET /metrics: Prometheus metrics endpoint
GET /api/demo/metrics: Demo endpoint that simulates database and API operations
GET /api/users/:userId/data: Example endpoint that demonstrates a complex operation

Dashboard Usage
The main API Performance Dashboard provides:

Overview Metrics: Response time, error rate, and request volume
Endpoint Breakdown: Performance metrics by API endpoint
Component Analysis: Database query and external service performance
Correlated Logs & Traces: Detailed context for investigating issues

To use the dashboard:

Log in to Grafana at http://localhost:3001
Navigate to Dashboards → API Performance Dashboard
Use filters to focus on specific time ranges or endpoints
Click on data points to drill down to logs and traces

Project Structure
Copyatlan-observability/
│
├── src/
│   ├── api/
│   │   └── index.ts                  # API implementation
│   │
│   ├── instrumentation/
│   │   └── tracer.ts                 # OpenTelemetry setup
│   │
│   ├── middleware/
│   │   └── performance-monitor.ts    # API monitoring middleware
│   │
│   └── index.ts                      # Main application entry point
│
├── config/
│   ├── prometheus.yml                # Prometheus configuration
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   └── datasources.yml   # Grafana datasource config
│   │   │   └── dashboards/
│   │   │       └── dashboards.yml    # Grafana dashboard config
│   │   └── dashboards/
│   │       └── api-dashboard.json    # Dashboard JSON
│   │
│   ├── otel-collector-config.yaml    # OpenTelemetry Collector config
│   ├── promtail-config.yaml          # Promtail config for log collection
│   ├── tempo.yaml                    # Tempo configuration
│   └── alertmanager.yml              # Alertmanager configuration
│
├── docs/
│   ├── clean-architecture.svg        # System architecture diagram
│   ├── er-diagram.svg                # Data model diagram
│   ├── design-document.md            # Design explanation document
│   └── implementation-guide.md       # Implementation guide
│
├── docker-compose.yml                # Docker Compose file
├── Dockerfile                        # Dockerfile for the API service
├── package.json                      # Node.js dependencies
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # This file
Design Decisions and Tradeoffs
1. OpenTelemetry as Instrumentation Standard

Benefits: Vendor-neutral, future-proof, consistent implementation
Tradeoffs: Learning curve, integration complexity

2. Three Specialized Backends vs. All-in-One Solution

Benefits: Best-in-class capabilities, flexibility, open-source ecosystem
Tradeoffs: Integration complexity, multiple systems to maintain

3. Correlation Over Causation

Benefits: Simpler implementation, works with existing engineer expertise
Tradeoffs: Still requires human interpretation, not fully automated

4. Detail vs. Performance

Benefits: Rich context for troubleshooting, manageable data volume
Tradeoffs: Some loss of information through sampling

Future Improvements

Anomaly Detection: Implement ML-based detection of unusual patterns
Service Level Objectives (SLOs): Define formal reliability targets
Enhanced Business Context: Better correlate technical metrics with user impact
Template Library Expansion: More pre-built dashboards for common services
Automated RCA: More advanced root cause analysis capabilities

Troubleshooting
No data appearing in Grafana:

Check if Prometheus targets are UP in Prometheus UI
Verify the data sources are configured correctly in Grafana
Generate more traffic to the API service

Services failing to start:

Check Docker Compose logs: docker-compose logs [service-name]
Verify network connectivity between services
Ensure all config files exist in the correct locations

Contributing

Fork the repository
Create your feature branch: git checkout -b feature/amazing-feature
Commit your changes: git commit -m 'Add some amazing feature'
Push to the branch: git push origin feature/amazing-feature
Open a Pull Request

License
This project is licensed under the MIT License - see the LICENSE file for details.
Acknowledgments

Atlan team for the interesting challenge
OpenTelemetry community for the excellent instrumentation tools
Grafana Labs for their observability stack

# Telemetry API — NestJS backend

[English lab guide](../README.md) · [Guía completa en español](../docs/README.es.md)

NestJS 12, TypeScript, ESM and AWS SDK for JavaScript v3. This backend accepts telemetry and writes to a local AWS Emulator. Follow the main guide for Linux Mint setup, emulator installation, resource initialization and screenshots.

## Local startup

Start AWS Emulator in a separate terminal. From the repository root:

```bash
source scripts/use-emulator.sh
bash scripts/init-aws.sh
cd backend
npm ci
if [ ! -f .env ]; then cp .env.example .env; fi
npm run start:dev
```

Keep these values in `backend/.env`:

```dotenv
S3_BUCKET_NAME=telemetry-raw-logs
DYNAMODB_TABLE_NAME=AgentStatus
SQS_QUEUE_NAME=high-cpu-alerts
```

The service requires `AWS_ENDPOINT_URL=https://127.0.0.1:9297`. Region, run-specific credentials, configuration and CA trust come from the sourced script. Launch from `backend/` so `ConfigModule` reads the local `.env`. Source the script in every new backend shell. Never commit `.env` or emulator credentials/certificates.

The API binds to **`http://127.0.0.1:3000`**. `PORT` is not read by the current implementation. `npm start` runs without watch mode; `npm run start:dev` watches for changes. This guide covers local execution; no cloud deployment has been validated.

## HTTP contract

`POST /telemetry` with `Content-Type: application/json`:

| Field | Required | Rule |
| --- | --- | --- |
| `agentId` | Yes | Nonempty string |
| `hostname` | Yes | Nonempty string |
| `cpuUsage` | Yes | JSON number, 0–100 inclusive |
| `memoryUsage` | Yes | JSON number, 0–100 inclusive |

`ValidationPipe` uses `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`; extra fields are rejected. There is no `GET /` route or health endpoint in this API.

```bash
curl -i -sS -X POST http://127.0.0.1:3000/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"node-01","hostname":"linux-mint-lab","cpuUsage":35.5,"memoryUsage":48.2}'
```

A successful request returns HTTP **201** with `status: "processed"`, `agentId`, a generated `timestamp`, `s3Key`, and boolean `alertTriggered`. The service performs:

1. DynamoDB `PutCommand`: replaces the `AgentStatus` item identified by `agentId`; includes the measurements and `updatedAt`.
2. S3 `PutObjectCommand`: stores measurements plus `timestamp` as JSON under `logs/<agentId>/<uuid>.json` in `telemetry-raw-logs`.
3. When **`cpuUsage >= 80`**, resolves `high-cpu-alerts` with `GetQueueUrlCommand` and sends a JSON `HIGH_CPU_USAGE` message with agent ID, CPU usage and timestamp.

S3 uses path-style addressing. SQS sets `useQueueUrlAsEndpoint: false`; the queue URL can look like an AWS URL while SDK transport stays on the configured local endpoint. Memory usage alone does not trigger alerts.

Invalid input returns **400** before the service runs. Selected connection-error messages map to **503**; other processing errors map to **500**. Sequential writes are not transactional, so an error can leave partial data. Retries can create additional S3 objects or alerts. No authentication, queue consumer, idempotency handling or rate limiting is implemented.

## Tests and build

Run from `backend/` with dependencies installed:

```bash
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.config.e2e.ts
npm run build
```

| Command | Verified on 2026-11-21 | What it checks |
| --- | --- | --- |
| Unit config (`npm test`) | 2 passed | Controller passes payload to mocked service and returns its result/alert flag |
| E2E config (`npm run test:e2e`) | 3 passed | HTTP 201 for valid input; HTTP 400 for CPU > 100 and missing `agentId` |
| `npm run build` | Passed | NestJS TypeScript compilation |

Both suites replace `AppService` with a mock and do not require a running emulator. They do not validate SDK operations, service CPU threshold logic or service failure behavior. The manual emulator integration evidence is in the [English guide](../README.md) and [Spanish guide](../docs/README.es.md); it is separate from these tests. Coverage was not measured during documentation review.

## Files to inspect

- [main.ts](src/main.ts): loopback listener and global validation.
- [app.module.ts](src/app.module.ts): global configuration, controller and service registration.
- [telemetry.dto.ts](src/dto/telemetry.dto.ts): request validation.
- [app.controller.ts](src/app.controller.ts): POST endpoint.
- [app.service.ts](src/app.service.ts): AWS clients, endpoint guard, storage and alerts.
- [app.controller.spec.ts](src/app.controller.spec.ts): two unit tests.
- [app.e2e-spec.ts](test/app.e2e-spec.ts): three HTTP E2E tests.

## Optional Observe integration

`@nestjs/observe` is installed, but `AppModule` does not register `ObserveModule`; the lab does not claim Observe instrumentation. If you separately choose to configure that integration, run `npx @nestjs/observe link` from `backend/` to start its linking flow and review the required instrumentation setup. It is not required for this lab or its tests. Keep any generated key pair in the ignored `.env`.

For security, emulator lifecycle, troubleshooting and GitHub publication, use the complete lab guides linked above. The backend package currently declares `UNLICENSED`; the old starter-template license and deployment claims do not describe this repository.

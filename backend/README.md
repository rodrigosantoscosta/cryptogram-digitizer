# Backend API Gateway

Fastify-based API gateway for the Cryptogram Digitizer OCR service.

## Architecture

```
Frontend (React) → Backend (Fastify:4000) → OCR Service (FastAPI:5000)
```

## Endpoints

- `GET /api/health` - Health check (proxies to OCR service)
- `POST /api/ocr/cell` - OCR single cell (proxies to OCR service)
- `POST /api/ocr/batch` - OCR batch of cells (chunks into 16-cell requests)

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot-reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `OCR_SERVICE_URL` | `http://localhost:5000` | Python OCR service URL |
| `CORS_ORIGIN` | `*` | CORS allowed origin |
| `LOG_LEVEL` | `info` | Logging level |

## Docker

```bash
# Build
docker build -t cryptogram-backend .

# Run
docker run -p 4000:4000 -e OCR_SERVICE_URL=http://ocr-service:5000 cryptogram-backend
```

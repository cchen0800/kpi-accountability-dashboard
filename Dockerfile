# Stage 1: Build React frontend
FROM node:22-slim AS frontend
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.html vite.config.js ./
COPY src/ src/
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY api/ .
COPY synthetic_data.json .
COPY --from=frontend /app/dist/ dist/

EXPOSE 5100

ENV PYTHONUNBUFFERED=1

RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /app/data && chown -R app:app /app/data

USER app

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:5100 --workers ${WEB_CONCURRENCY:-2} --worker-class gthread --threads 8 --timeout 120 --graceful-timeout 30"]

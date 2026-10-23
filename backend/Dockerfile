FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY pyproject.toml ./
COPY kothora ./kothora
RUN pip install --no-cache-dir . && useradd --system --uid 1001 kothora

USER kothora
EXPOSE 8000
# One worker per container; scale with replicas. The in-process cache is per worker,
# so set KOTHORA_REDIS_URL whenever more than one runs.
CMD ["uvicorn", "kothora.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]

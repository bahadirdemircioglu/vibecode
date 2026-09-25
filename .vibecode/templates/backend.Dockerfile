# Backend Dockerfile template → copy to backend/Dockerfile
# (.vibecode/standards/docker.md §8 lists the rules this satisfies)
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Lock file BEFORE install → reproducible + cached layer
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && chown -R appuser:appuser /app
USER appuser

CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

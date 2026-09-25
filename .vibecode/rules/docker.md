---
paths: ["Dockerfile*", "docker-compose*.yml", "docker-compose*.yaml"]
---

# Docker & Infrastructure

- **Non-root `USER`** directive mandatory in all Dockerfiles
- `extra_hosts: host.docker.internal:host-gateway` required on **every** service
- **Healthcheck** required on every service definition
- Copy **lock files before install step** for layer caching (`uv.lock`, `package-lock.json`)
- `postgres-test` must use **tmpfs** for ephemeral test data
- Never expose ports to `0.0.0.0` in production -- bind to `127.0.0.1` where possible
- Use multi-stage builds to keep final images lean

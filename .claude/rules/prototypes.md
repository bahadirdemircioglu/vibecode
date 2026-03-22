---
paths: ["prototypes/**", "experiments/**", "scratch/**"]
---

# Prototypes & Experiments

- **RELAXED standards** -- focus on speed, not perfection
- No linting requirements, no test requirements
- **BUT:** must include a `README.md` explaining what this prototype tests and its conclusions
- Must be clearly marked as **non-production code** (comment at top of each file)
- Never import from prototype directories in production code (`backend/`, `frontend/`)
- Prototypes are disposable -- do not add them to CI/CD pipelines
- Clean up when the experiment is complete: archive learnings, delete the code

# syntax=docker/dockerfile:1
#
# Backend image for Render.
#
# Slim rather than alpine: psycopg and argon2-cffi both ship manylinux wheels,
# and alpine's musl forces a source build of both, turning a 40-second image
# into a five-minute one.

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, as their own layer: application edits then rebuild in
# seconds instead of reinstalling the whole tree.
COPY apps/api/pyproject.toml ./apps/api/pyproject.toml
RUN pip install --upgrade pip && \
    pip install \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.32" \
      "psycopg[binary,pool]>=3.2" \
      "pydantic>=2.9" \
      "pydantic-settings>=2.6" \
      "argon2-cffi>=23.1" \
      "pyjwt>=2.9" \
      "email-validator>=2.2"

# The seed script reads the migrations and the raw feed from the repo root, so
# both come along: the same image can serve the API and run the one-command
# seed as a Render job.
COPY db ./db
COPY apps/api ./apps/api

WORKDIR /app/apps/api

# Run as a non-root user. If the process is ever compromised it should not own
# the filesystem it is standing on.
RUN useradd --create-home --uid 10001 coinfold && chown -R coinfold /app
USER coinfold

# Render supplies PORT and it is not knowable at build time, so the shell form
# is required here for the variable to expand.
ENV PORT=8000
CMD uvicorn coinfold.main:app --host 0.0.0.0 --port ${PORT} --workers 2

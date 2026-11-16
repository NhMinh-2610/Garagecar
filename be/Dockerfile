ARG PYTHON_IMAGE=python:3.11-slim
FROM ${PYTHON_IMAGE} AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1

# Install dependencies
COPY requirements.txt requirements.lock ./
RUN pip install --no-cache-dir pip==26.3 && pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

RUN useradd --uid 10001 --create-home appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

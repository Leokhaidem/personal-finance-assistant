# Use Python 3.12
FROM python:3.12-slim

# Prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1

# Show Python logs immediately
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better Docker caching)
COPY requirements.txt .

# Upgrade pip
RUN pip install --upgrade pip

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create Chroma directory
RUN mkdir -p /app/chroma_db

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
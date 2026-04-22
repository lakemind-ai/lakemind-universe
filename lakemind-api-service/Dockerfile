FROM python:3.12-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev liblz4-dev unixodbc-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 80

CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "80"]

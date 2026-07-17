FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt requirements-models.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-models.txt

COPY . .
RUN chmod +x scripts/entrypoint.sh

EXPOSE 8000
CMD ["scripts/entrypoint.sh"]

FROM python:3.11-slim

WORKDIR /app

# Copio le dipendenze e le installo
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copio il codice sorgente
COPY main.py .

# Esponiamo la porta usata da FastAPI
EXPOSE 8000

# Comando di avvio
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

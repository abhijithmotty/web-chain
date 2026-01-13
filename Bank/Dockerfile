FROM python:3.9-slim

WORKDIR /app

# Install dependencies
RUN pip install flask

# Copy application
COPY app.py /app/

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]
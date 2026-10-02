FROM python:3.12-slim
RUN useradd -u 10001 -m studio && mkdir -p /models && chown studio /models
WORKDIR /app
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY server.py categories.py ./
ENV HF_HOME=/models OMP_NUM_THREADS=2 TOKENIZERS_PARALLELISM=false
USER studio
EXPOSE 8090
CMD ["python", "server.py"]

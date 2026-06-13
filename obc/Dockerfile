# SCSP Mock OBC — UDP satellite simulator. Phase 3 containerization (TRD §18.3).
FROM python:3.12-slim
WORKDIR /app
COPY obc_simulator.py .
RUN useradd --create-home scsp
USER scsp
EXPOSE 9000/udp
CMD ["python", "obc_simulator.py"]

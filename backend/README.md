# HELIOS Backend — Milestone 1
Prototype API for astronaut profiles and simulated health measurements.

From `backend/`, activate your venv and run:
```powershell
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/docs

In a second terminal, from `backend/`:
```powershell
python simulator/seed_crew.py
python simulator/stream_measurements.py
```
All generated records are labelled `simulated=true`. Plausibility bounds are input-quality checks only, not medical thresholds. No diagnosis or clinical alerts are provided.

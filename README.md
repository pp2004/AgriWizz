# Kisan-Netra (AgriWizz)
Hyper-local AI advisory loop for farmers. Flask API + PWA UI + ViT inference + SQLite demo DB.

## Quickstart
python -m venv .venv
# Windows: .\.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python scripts/init_db.py
python -m app.app  # open http://localhost:8000

## Model
Set MODEL_WEIGHTS=models/vit_plant_disease.pth (ViT, 38 classes). Put your .pth in models/.

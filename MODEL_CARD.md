# Model Card — Plant Disease ViT (Kisan-Netra)
Model: ViT classifier for PlantVillage (38 classes)
Weights: models/vit_plant_disease.pth
Intended Use: Educational/hackathon prototype for photo-based disease diagnosis
Data: PlantVillage (Kaggle). Preproc: Resize 256 → CenterCrop 224 → Normalize (ImageNet)
Ethics/Safety: Advisory only; domain shift likely; no PII; respect dataset license

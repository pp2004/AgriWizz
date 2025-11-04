import os, json, torch
from PIL import Image
import numpy as np

try:
    import timm
except Exception as e:
    timm = None

import torchvision.transforms as T

HERE = os.path.dirname(__file__)

with open(os.path.join(HERE, "labels.json"), "r") as f:
    LABELS = json.load(f)

def get_device():
    dev = os.environ.get("DEVICE","cpu")
    return torch.device(dev if torch.cuda.is_available() and dev.startswith("cuda") else "cpu")

def build_vit_model(num_classes=38, arch="vit_base_patch16_224"):
    if timm is None:
        raise RuntimeError("timm is required to build ViT model. Please install timm.")
    model = timm.create_model(arch, pretrained=False, num_classes=num_classes)
    return model

def load_weights(model, weights_path):
    sd = torch.load(weights_path, map_location="cpu")
    if isinstance(sd, dict) and 'state_dict' in sd:
        sd = sd['state_dict']
        new_sd = {}
        for k,v in sd.items():
            nk = k.replace("module.","").replace("model.","")
            new_sd[nk] = v
        sd = new_sd
    try:
        model.load_state_dict(sd, strict=False)
    except Exception as e:
        head_name = None
        for name in ["head.weight", "head.bias", "classifier.weight", "classifier.bias"]:
            if any(name in k for k in sd.keys()):
                head_name = name.split(".")[0]
                break
        if head_name:
            sd = {k:v for k,v in sd.items() if not k.startswith(head_name)}
            model.load_state_dict(sd, strict=False)
        else:
            raise
    return model

def get_transforms():
    return T.Compose([
        T.Resize(256, interpolation=T.InterpolationMode.BILINEAR),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

def predict_image(model, img: Image.Image, device=None, topk=3):
    device = device or get_device()
    model.eval().to(device)
    tfm = get_transforms()
    x = tfm(img).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
    top_idx = np.argsort(-probs)[:topk]
    return [{
        "label": LABELS[i] if i < len(LABELS) else f"class_{i}",
        "prob": float(probs[i])
    } for i in top_idx]

def load_model_from_env():
    arch = os.environ.get("MODEL_ARCH","vit_base_patch16_224")
    num_classes = int(os.environ.get("NUM_CLASSES","38"))
    weights = os.environ.get("MODEL_WEIGHTS", os.path.join("models","vit_plant_disease.pth"))
    device = get_device()
    model = build_vit_model(num_classes=num_classes, arch=arch)
    model = load_weights(model, weights)
    model.to(device)
    return model, device

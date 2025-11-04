from PIL import Image
import numpy as np
from app.model_loader import load_model_from_env, predict_image

if __name__ == "__main__":
    model, device = load_model_from_env()
    img = Image.fromarray((np.random.rand(224,224,3)*255).astype('uint8'))
    out = predict_image(model, img, device, topk=3)
    print("Loaded model on", device)
    print(out)

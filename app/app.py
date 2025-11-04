import os, io
from flask import Flask, request, jsonify, render_template, send_from_directory
from PIL import Image
from .model_loader import load_model_from_env, predict_image
from .price_engine import PriceEngine

app = Flask(__name__, template_folder="templates", static_folder="static")

MODEL, DEVICE = None, None
PRICE_ENGINE = PriceEngine()

@app.route("/api/health")
def health():
    return {"status":"ok","device":str(DEVICE) if DEVICE else "unloaded"}

@app.route("/api/predict", methods=["POST"])
def api_predict():
    if "image" not in request.files:
        return jsonify({"error":"no image"}), 400
    f = request.files["image"]
    img = Image.open(io.BytesIO(f.read())).convert("RGB")
    res = predict_image(MODEL, img, DEVICE, topk=3)
    return jsonify({"predictions": res})

@app.route("/api/recommend", methods=["POST"])
def api_recommend():
    data = request.get_json(force=True, silent=True) or {}
    district = data.get("district","Hyderabad")
    crop = data.get("crop","Tomato")
    disease = data.get("disease","Tomato___Early_blight")
    baseline_price = float(data.get("baseline_price_per_kg", 20.0))
    acreage = float(data.get("acreage", 1.0))
    rec = PRICE_ENGINE.suggest(district, crop, disease, baseline_price, acreage)
    if rec is None:
        return jsonify({"message":"No local price entries. Try updating data."}), 404
    return jsonify({
        "best_product": rec.best_product,
        "brand": rec.brand,
        "dealer": rec.dealer,
        "unit_price_inr": rec.unit_price_inr,
        "expected_yield_gain_pct": rec.expected_yield_gain_pct,
        "expected_profit_inr": rec.expected_profit_inr,
        "rationale": rec.rationale
    })

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/manifest.webmanifest")
def manifest():
    return send_from_directory(app.static_folder, "manifest.webmanifest", mimetype="application/manifest+json")

@app.route("/service-worker.js")
def sw():
    return send_from_directory(app.static_folder, "js/service-worker.js", mimetype="application/javascript")

def main():
    global MODEL, DEVICE
    MODEL, DEVICE = load_model_from_env()
    app.run(host=os.environ.get("HOST","0.0.0.0"), port=int(os.environ.get("PORT","8000")))

if __name__ == "__main__":
    main()

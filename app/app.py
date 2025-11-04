import os, io, csv
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from PIL import Image
from .model_loader import load_model_from_env, predict_image
from .price_engine import PriceEngine
from sqlalchemy import text
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    pass
import pandas as pd
import json

app = Flask(__name__, template_folder="templates", static_folder="static")

MODEL, DEVICE = None, None
PRICE_ENGINE = PriceEngine()

@app.route("/api/health")
def health():
    return {"status":"ok","device":str(DEVICE) if DEVICE else "unloaded"}

@app.route("/api/version")
def version():
    return {"app":"kisan-netra","version":"2.0","features":["tabs","history","voice","price_manager","labels"]}

@app.route("/api/labels")
def labels():
    # serve labels.json from package
    here = os.path.dirname(__file__)
    with open(os.path.join(here,"labels.json"),"r") as f:
        labels = json.load(f)
    return jsonify(labels)

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

# ----------- Price Manager API -----------
def _conn():
    return PRICE_ENGINE.engine

@app.route("/api/prices", methods=["GET"])
def prices_list():
    with _conn().begin() as conn:
        rows = conn.execute(text("""
            SELECT id, district, dealer, product_name, brand, crop, disease,
                   unit_price_inr, unit, expected_yield_gain_pct, notes
            FROM prices ORDER BY id DESC
        """)).mappings().all()
    return jsonify([dict(r) for r in rows])

@app.route("/api/prices", methods=["POST"])
def prices_create():
    j = request.get_json(force=True)
    with _conn().begin() as conn:
        conn.execute(text("""
            INSERT INTO prices (district,dealer,product_name,brand,crop,disease,
                                unit_price_inr,unit,expected_yield_gain_pct,notes)
            VALUES (:district,:dealer,:product_name,:brand,:crop,:disease,
                    :unit_price_inr,:unit,:expected_yield_gain_pct,:notes)
        """), j)
    return jsonify({"ok":True})

@app.route("/api/prices/<int:pid>", methods=["PUT"])
def prices_update(pid):
    j = request.get_json(force=True)
    j["id"] = pid
    with _conn().begin() as conn:
        conn.execute(text("""
            UPDATE prices SET
              district=:district, dealer=:dealer, product_name=:product_name, brand=:brand,
              crop=:crop, disease=:disease, unit_price_inr=:unit_price_inr, unit=:unit,
              expected_yield_gain_pct=:expected_yield_gain_pct, notes=:notes
            WHERE id=:id
        """), j)
    return jsonify({"ok":True})

@app.route("/api/prices/<int:pid>", methods=["DELETE"])
def prices_delete(pid):
    with _conn().begin() as conn:
        conn.execute(text("DELETE FROM prices WHERE id=:id"), {"id":pid})
    return jsonify({"ok":True})

@app.route("/api/prices/export")
def prices_export():
    with _conn().begin() as conn:
        df = pd.read_sql(text("SELECT district,dealer,product_name,brand,crop,disease,unit_price_inr,unit,expected_yield_gain_pct,notes FROM prices"), conn)
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False)
    return Response(csv_buf.getvalue(), mimetype="text/csv")

@app.route("/api/prices/import", methods=["POST"])
def prices_import():
    if "file" not in request.files:
        return jsonify({"error":"no file"}), 400
    f = request.files["file"]
    df = pd.read_csv(io.BytesIO(f.read()))
    cols = {"district","dealer","product_name","brand","crop","disease","unit_price_inr","unit","expected_yield_gain_pct","notes"}
    if not cols.issubset(set(df.columns)):
        return jsonify({"error":"missing columns"}), 400
    with _conn().begin() as conn:
        df.to_sql("prices", conn, if_exists="append", index=False)
    return jsonify({"ok":True})

# ----------- UI + PWA -----------
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

import io
from PIL import Image
from app.app import app

def test_health():
    client = app.test_client()
    rv = client.get("/api/health")
    assert rv.status_code == 200

def test_predict_dummy(monkeypatch):
    from app import app as app_mod
    class Dummy: pass
    app_mod.MODEL, app_mod.DEVICE = Dummy(), "cpu"
    import app.model_loader as ml
    def fake_pred(model, img, device, topk=3):
        return [{"label": "Tomato___Early_blight", "prob": 0.9}]
    ml.predict_image = fake_pred

    client = app.test_client()
    img = Image.new("RGB",(224,224),(255,0,0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    data = {"image": (buf, "test.png")}
    rv = client.post("/api/predict", data=data, content_type="multipart/form-data")
    assert rv.status_code == 200
    assert "predictions" in rv.json

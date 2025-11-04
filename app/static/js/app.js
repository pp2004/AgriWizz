async function predict(e){
  e.preventDefault();
  const file = document.getElementById("image").files[0];
  if(!file){ alert("Please select an image"); return; }
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/predict", {method:"POST", body: fd});
  const data = await res.json();
  document.getElementById("predictOut").textContent = JSON.stringify(data, null, 2);
  if(data && data.predictions && data.predictions.length > 0){
    document.getElementById("disease").value = data.predictions[0].label;
  }
}
document.getElementById("predictForm").addEventListener("submit", predict);

async function recommend(e){
  e.preventDefault();
  const payload = {
    district: document.getElementById("district").value,
    crop: document.getElementById("crop").value,
    disease: document.getElementById("disease").value,
    baseline_price_per_kg: parseFloat(document.getElementById("bp").value),
    acreage: parseFloat(document.getElementById("ac").value)
  };
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  document.getElementById("recOut").textContent = JSON.stringify(data, null, 2);
}
document.getElementById("recForm").addEventListener("submit", recommend);

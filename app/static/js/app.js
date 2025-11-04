// ---------- tiny utils ----------
const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));

const toast = (msg) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 1600);
};

const infoModal = {
  open(title, body){
    $("#infoTitle").textContent = title || "Info";
    $("#infoBody").textContent  = body || "";
    $("#infoModal").hidden = false;
  },
  close(){ $("#infoModal").hidden = true; }
};

// ---------- theme + language ----------
const themeToggle = $("#themeToggle");
const themeSelect = $("#themeSelect");
const langSelect  = $("#langSelect");
const root        = document.documentElement;

function setTheme(theme){
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if(themeSelect) themeSelect.value = theme;
}

themeToggle.addEventListener("click", () => {
  const now = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  setTheme(now);
});
if (themeSelect) themeSelect.addEventListener("change", e => setTheme(e.target.value));
setTheme(localStorage.getItem("theme") || "light");

langSelect.addEventListener("change", () => {
  localStorage.setItem("lang", langSelect.value);
  toast(`Language: ${langSelect.value}`);
});
langSelect.value = localStorage.getItem("lang") || "en";

// ---------- tabs ----------
const views = {
  show(id){
    $$(".view").forEach(v => v.classList.remove("active"));
    $(`#view-${id}`).classList.add("active");
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  }
};
$$(".tab").forEach(btn => btn.addEventListener("click", ()=> views.show(btn.dataset.tab)));

// ---------- health ----------
async function getHealth(){
  try{
    const r = await fetch("/api/health");
    const j = await r.json();
    $("#healthDot").classList.add(j.device && j.device !== "unloaded" ? "status-ok" : "status-bad");
    $("#healthInfo").innerHTML = `
      <p><b>Status:</b> ${j.status}</p>
      <p><b>Device:</b> ${j.device}</p>
    `;
  }catch(e){
    $("#healthDot").classList.add("status-bad");
    $("#healthInfo").textContent = "Backend not reachable";
  }
}
getHealth();

// ---------- info icons ----------
$$(".info").forEach(i => {
  i.addEventListener("click", () => {
    infoModal.open(i.dataset.infoTitle, i.dataset.info.trim());
  });
});
$("#infoOk").addEventListener("click", () => infoModal.close());
$("#infoClose").addEventListener("click", () => infoModal.close());
$("#infoModal").addEventListener("click", (e) => {
  if(e.target.id === "infoModal") infoModal.close();
});

// ---------- Diagnose  ----------
const dropZone = $("#dropZone");
const imageInput = $("#imageInput");
const captureBtn = $("#captureBtn");
const previewCanvas = $("#previewCanvas");
const predictBtn = $("#predictBtn");
const predictSpin = $("#predictSpin");
const predictionsWrap = $("#predictions");
let currentImageBlob = null;
let lastPredictions = null;
let labelsCache = [];

function drawPreview(file){
  const ctx = previewCanvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    const {width:W, height:H} = previewCanvas;
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,W,H);
    const r = Math.min(W/img.width, H/img.height);
    const w = img.width*r, h = img.height*r;
    ctx.drawImage(img, (W-w)/2, (H-h)/2, w, h);
  };
  img.src = URL.createObjectURL(file);
}

["dragenter","dragover"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.add("dragover");
}));
["dragleave","drop"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", (e)=>{
  const f = e.dataTransfer.files?.[0]; if(!f) return;
  currentImageBlob = f;
  drawPreview(f);
});

imageInput.addEventListener("change", (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  currentImageBlob = f;
  drawPreview(f);
});

captureBtn.addEventListener("click", ()=> imageInput.click());

async function ensureLabels(){
  if(labelsCache.length) return;
  try{
    const r = await fetch("/api/labels");
    labelsCache = await r.json();
    const sel = $("#disease");
    sel.innerHTML = labelsCache.map(x => `<option value="${x}">${x}</option>`).join("");
  }catch(e){}
}
ensureLabels();

function renderPredictions(list){
  predictionsWrap.innerHTML = "";
  if(!list || !list.length){
    predictionsWrap.innerHTML = `<div class="muted">No predictions yet.</div>`;
    return;
  }
  list.forEach(p => {
    const div = document.createElement("div");
    div.className = "pred-card";
    div.innerHTML = `
      <div class="pred-main">
        <div>${p.label}</div>
        <div class="prob">${(p.prob*100).toFixed(1)}%</div>
      </div>
    `;
    div.addEventListener("click", ()=>{
      $("#disease").value = p.label;
      toast("Disease filled in Recommend tab");
      views.show("recommend");
    });
    predictionsWrap.appendChild(div);
  });
}

predictBtn.addEventListener("click", async ()=>{
  if(!currentImageBlob){ toast("Pick an image first"); return; }
  predictSpin.hidden = false;
  try{
    // Convert whatever you loaded (HEIC, JPEG, etc.) into a PNG from canvas
    const blob = await new Promise(res => previewCanvas.toBlob(res, "image/png", 0.95));
    const fd = new FormData();
    fd.append("image", blob, "upload.png");

    const r = await fetch("/api/predict", {method:"POST", body: fd});
    const j = await r.json();
    lastPredictions = j.predictions || [];
    renderPredictions(lastPredictions);
    if(lastPredictions[0]){
      $("#disease").value = lastPredictions[0].label;
    }
    toast("Diagnosis complete");
  }catch(e){
    console.error(e);
    toast("Prediction failed");
  }finally{
    predictSpin.hidden = true;
  }
});

// ---------- Recommend ----------
const fillFromPrediction = $("#fillFromPrediction");
const recBtn = $("#recBtn");
const recSpin = $("#recSpin");
const recOut = $("#recOut");
const saveToHistoryBtn = $("#saveToHistory");
const speakAdviceBtn = $("#speakAdvice");

fillFromPrediction.addEventListener("click", ()=>{
  if(lastPredictions && lastPredictions[0]){
    $("#disease").value = lastPredictions[0].label;
    toast("Filled disease from top prediction");
  }else{
    toast("No predictions yet");
  }
});

recBtn.addEventListener("click", async ()=>{
  recSpin.hidden = false;
  recOut.innerHTML = "";
  try{
    const payload = {
      district: $("#district").value,
      crop: $("#crop").value,
      disease: $("#disease").value,
      baseline_price_per_kg: parseFloat($("#bp").value),
      acreage: parseFloat($("#ac").value)
    };
    const r = await fetch("/api/recommend", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if(r.ok){
      recOut.innerHTML = `
        <div><span class="reco-badge">Product</span> ${j.best_product} (${j.brand}) via ${j.dealer}</div>
        <div><span class="reco-badge">Price</span> ₹${j.unit_price_inr}</div>
        <div><span class="reco-badge">Yield +%</span> ${j.expected_yield_gain_pct}%</div>
        <div><span class="reco-badge">Est. Profit</span> ₹${Math.round(j.expected_profit_inr)}</div>
        <div class="muted">${j.rationale}</div>
      `;
      saveToHistoryBtn.disabled = false;
      speakAdviceBtn.disabled = false;
      // cache latest recommendation for voice
      localStorage.setItem("latestAdvice", JSON.stringify({ts:Date.now(), data:j}));
    }else{
      recOut.textContent = j.message || "No local price entries found";
      saveToHistoryBtn.disabled = true;
      speakAdviceBtn.disabled = true;
    }
  }catch(e){
    recOut.textContent = "Recommendation failed";
    saveToHistoryBtn.disabled = true;
    speakAdviceBtn.disabled = true;
  }finally{
    recSpin.hidden = true;
  }
});

saveToHistoryBtn.addEventListener("click", ()=>{
  const hist = JSON.parse(localStorage.getItem("history")||"[]");
  const item = {
    ts: Date.now(),
    img: currentImageBlob ? {name: currentImageBlob.name, size: currentImageBlob.size} : null,
    preds: lastPredictions,
    input: {
      district: $("#district").value, crop: $("#crop").value, disease: $("#disease").value,
      bp: $("#bp").value, ac: $("#ac").value
    },
    advisory: $("#recOut").innerText
  };
  hist.unshift(item);
  localStorage.setItem("history", JSON.stringify(hist));
  toast("Saved to history");
});

// ---------- History ----------
function renderHistory(){
  const list = JSON.parse(localStorage.getItem("history")||"[]");
  const wrap = $("#historyList");
  wrap.innerHTML = "";
  if(!list.length){ wrap.innerHTML = `<div class="muted">No history yet</div>`; return; }
  list.forEach((it, idx)=>{
    const d = new Date(it.ts);
    const card = document.createElement("div");
    card.className = "hist-item";
    card.innerHTML = `
      <div><b>${d.toLocaleString()}</b></div>
      <div class="muted">${it.img ? `Image: ${it.img.name} (${it.img.size} bytes)` : "No image metadata"}</div>
      <div><b>Inputs:</b> ${it.input.district} / ${it.input.crop} / ${it.input.disease} (₹${it.input.bp}/kg; ${it.input.ac} acres)</div>
      <div><b>Top pred:</b> ${it.preds?.[0]?.label || "-" } ${(it.preds?.[0]?.prob*100||0).toFixed(1)}%</div>
      <div class="muted">Advisory: ${it.advisory || "-"}</div>
      <div class="row">
        <button class="btn ghost" data-act="restore" data-idx="${idx}">Restore</button>
        <button class="btn danger" data-act="delete" data-idx="${idx}">Delete</button>
      </div>
    `;
    wrap.appendChild(card);
  });
}
$("#histExport").addEventListener("click", ()=>{
  const blob = new Blob([localStorage.getItem("history")||"[]"], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "history.json"; a.click();
});
$("#histImport").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const txt = await f.text();
  localStorage.setItem("history", txt);
  renderHistory();
  toast("History imported");
});
$("#histClear").addEventListener("click", ()=>{
  localStorage.removeItem("history"); renderHistory(); toast("History cleared");
});
$("#historyList").addEventListener("click", (e)=>{
  const act = e.target.dataset.act;
  const idx = +e.target.dataset.idx;
  const list = JSON.parse(localStorage.getItem("history")||"[]");
  if (act === "delete"){
    list.splice(idx,1); localStorage.setItem("history", JSON.stringify(list)); renderHistory(); return;
  }
  if (act === "restore"){
    const it = list[idx];
    $("#district").value = it.input.district;
    $("#crop").value     = it.input.crop;
    $("#disease").value  = it.input.disease;
    $("#bp").value       = it.input.bp;
    $("#ac").value       = it.input.ac;
    views.show("recommend");
    toast("Restored inputs");
  }
});

// ---------- Price Manager (CRUD) ----------
const pmBody = $("#pmBody");
async function pmLoad(){
  pmBody.innerHTML = "";
  try{
    const r = await fetch("/api/prices");
    const rows = await r.json();
    rows.forEach(row => pmBody.appendChild(pmRow(row)));
  }catch(e){
    pmBody.innerHTML = `<tr><td colspan="11">Failed to load prices</td></tr>`;
  }
}
function pmRow(row){
  const tr = document.createElement("tr");
  const fields = ["district","dealer","product_name","brand","crop","disease","unit_price_inr","unit","expected_yield_gain_pct","notes"];
  fields.forEach(k=>{
    const td = document.createElement("td");
    td.contentEditable = "true";
    td.dataset.key = k; td.textContent = row[k] ?? "";
    tr.appendChild(td);
  });
  const act = document.createElement("td");
  const save = document.createElement("button"); save.className="btn"; save.textContent="Save";
  const del  = document.createElement("button"); del.className="btn danger"; del.textContent="Delete";
  act.append(save, del);
  tr.appendChild(act);

  save.addEventListener("click", async ()=>{
    const payload = {};
    fields.forEach((k,i)=> payload[k] = tr.children[i].textContent.trim());
    payload.unit_price_inr = parseFloat(payload.unit_price_inr||"0");
    payload.expected_yield_gain_pct = parseFloat(payload.expected_yield_gain_pct||"0");
    const method = row.id ? "PUT" : "POST";
    const url = row.id ? `/api/prices/${row.id}` : "/api/prices";
    const r = await fetch(url, {method, headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    if(r.ok){ toast("Saved"); pmLoad(); } else { toast("Save failed"); }
  });
  del.addEventListener("click", async ()=>{
    if(!row.id){ tr.remove(); return; }
    const r = await fetch(`/api/prices/${row.id}`, {method:"DELETE"});
    if(r.ok){ tr.remove(); toast("Deleted"); } else { toast("Delete failed"); }
  });
  return tr;
}
$("#pmRefresh").addEventListener("click", pmLoad);
$("#pmAddRow").addEventListener("click", ()=> pmBody.prepend(pmRow({})));
$("#pmExport").addEventListener("click", async ()=>{
  const r = await fetch("/api/prices/export"); const csv = await r.text();
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "prices.csv"; a.click();
});
$("#pmImport").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const fd = new FormData(); fd.append("file", f);
  const r = await fetch("/api/prices/import", {method:"POST", body: fd});
  if(r.ok){ toast("Imported"); pmLoad(); } else { toast("Import failed"); }
});

// ---------- Voice ----------
const voiceTestBtn = $("#voiceTest");
const voiceSpeakLatestBtn = $("#voiceSpeakLatest");
voiceTestBtn.addEventListener("click", ()=> speak("Hello from Kisan-Netra"));
function speak(text){
  const u = new SpeechSynthesisUtterance(text);
  const lang = (localStorage.getItem("lang") || "en") === "hi" ? "hi-IN" : "en-IN";
  u.lang = lang;
  speechSynthesis.speak(u);
}
voiceSpeakLatestBtn.addEventListener("click", ()=>{
  const latest = JSON.parse(localStorage.getItem("latestAdvice")||"null");
  if(!latest){ toast("No advisory yet"); return; }
  const d = latest.data;
  const msg = `Recommended ${d.best_product} by ${d.brand} via ${d.dealer}. 
  Price rupees ${Math.round(d.unit_price_inr)}. 
  Estimated profit rupees ${Math.round(d.expected_profit_inr)}.`;
  speak(msg);
});

// enable voice button when we have something
if(localStorage.getItem("latestAdvice")) voiceSpeakLatestBtn.disabled = false;

// ---------- Labels list for disease dropdown ----------
async function loadLabels(){
  try{
    const r = await fetch("/api/labels"); const arr = await r.json();
    const sel = $("#disease");
    sel.innerHTML = arr.map(x=>`<option value="${x}">${x}</option>`).join("");
  }catch(e){}
}
loadLabels();

// ---------- wire view init ----------
views.show("diagnose");
renderHistory();
pmLoad();

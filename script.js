/* ========= Tiny helpers ========= */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const isNum = v => typeof v === "number" && isFinite(v);
const roundSmart = n => (Number.isInteger(n) ? n : +(n.toFixed(6)));
const normText = s => String(s||"").toLowerCase().replace(/\s+/g," ").trim();
const numbersIn = s => (String(s).match(/-?\d+(\.\d+)?/g)||[]).map(Number);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

/* ========= Topic synonyms & matcher ========= */
const TOPIC_SYNONYMS = {
  "electricity": ["ohm", "ohm’s law", "ohm's law", "ohms law", "voltage", "current", "resistance"],
  "speed distance time": ["speed", "distance", "time", "sdt", "motion"],
  "percent": ["percentage", "%", "discount"],
  "percentage": ["percent", "%", "discount"],
  "area": ["geometry", "rectangle", "triangle", "circle", "perimeter", "area of triangle", "circle area"],
  "simple interest": ["interest", "si"],
  "newton's second law": ["force", "f = m × a", "newton", "net force"],
  "lenses": ["lens", "thin lens", "convex", "focal length", "1/f = 1/v + 1/u"]
};
function topicMatches(item, query) {
  if (!query) return true;
  const q = normText(query);
  const hay = `${normText(item.topic)} ${normText(item.question)}`;
  if (hay.includes(q)) return true;
  const alts = TOPIC_SYNONYMS[q] || [];
  return alts.some(a => hay.includes(normText(a)));
}

/* ========= DOM ========= */
const tabBtns = $$(".tab");
const panels = {
  standard  : $("#panel-standard"),
  scientific: $("#panel-scientific"),
  converter : $("#panel-converter"),
  ai        : $("#panel-ai")
};
const displayInput = $("#displayInput");
const degToggle    = $("#degToggle");
const convCategory = $("#convCategory");
const fromUnit     = $("#fromUnit");
const toUnit       = $("#toUnit");
const fromValue    = $("#fromValue");
const toValue      = $("#toValue");
const convertBtn   = $("#convertBtn");
const aiInput       = $("#aiInput");
const solveBtn      = $("#solveBtn");
const clearAiBtn    = $("#clearAi");
const detectedTopic = $("#detectedTopic");
const usedFormula   = $("#usedFormula");
const resultOutput = $("#resultOutput");
const stepsBox     = $("#stepsBox");
const notesBox     = $("#notesBox");
const clsSelect   = $("#clsSelect");
const topicSelect = $("#topicSelect");
const modeSelect  = $("#modeSelect");
const countSelect = $("#countSelect");
const genBtn      = $("#genBtn");

let JUST_EVALUATED = false;
let DEG_MODE = degToggle ? !!degToggle.checked : true;
degToggle?.addEventListener("change", () => { DEG_MODE = !!degToggle.checked; });

/* ========= Tabs ========= */
tabBtns.forEach(b => {
  b.addEventListener("click", () => {
    tabBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    Object.values(panels).forEach(p => p.classList.remove("active"));
    panels[b.dataset.tab]?.classList.add("active");
    if (b.dataset.tab === "ai") setTimeout(()=>aiInput?.focus(),0);
  });
});

/* ========= Calculator ========= */
const SCI_SHORTMAP = {
  "sin":"sin(", "cos":"cos(", "tan":"tan(",
  "asin":"asin(", "acos":"acos(", "atan":"atan(",
  "ln":"ln(", "log":"log(", "exp":"exp(", "√":"√(",
  "π":"π", "e":"e", "^":"^", "!":"!", "%":"%", "x²":"^2", "x³":"^3"
};

$$('#panel-standard .keypad button, #panel-scientific .keypad button').forEach(btn=>{
  btn.addEventListener("click", () => {
    const raw = btn.dataset.key || SCI_SHORTMAP[btn.textContent.trim()] || btn.textContent.trim();
    insertKey(raw, btn);
  });
});

displayInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); calculateExpression(); return; }
  if (e.key === "Backspace") return;
  const allowed = /[0-9+\-*/().,^% πe√]/;
  if (e.key.length === 1 && !allowed.test(e.key) && !/[a-z]/i.test(e.key)) e.preventDefault();
});

function insertKey(k, sourceBtn) {
  if (k === "C") { displayInput.value = ""; setRightPanel("—", ["Cleared."], "—"); JUST_EVALUATED=false; return; }
  if (k === "⌫" || k === "back") { displayInput.value = displayInput.value.slice(0,-1); JUST_EVALUATED=false; return; }
  if (k === "=") { calculateExpression(); return; }

  if (k === "÷") k = "/";
  if (k === "×") k = "*";
  if (k === "−") k = "-";

  if (sourceBtn?.closest("#panel-scientific") && !sourceBtn.dataset.key) {
    const t = sourceBtn.textContent.trim();
    if (SCI_SHORTMAP[t]) k = SCI_SHORTMAP[t];
  }

  if (JUST_EVALUATED) {
    const isOp = v => ["+","-","*","/","^",")"].includes(v) || v==="÷"||v==="×"||v==="−"||v==="**";
    if (!isOp(k)) displayInput.value = "";
    JUST_EVALUATED = false;
  }

  const s = displayInput.value;
  const prev = s.slice(-1);
  const startsWithFuncOrParen = /^(\(|[a-zA-Z]|π|e|√)/.test(k);
  const prevEndsWithNumConstParen = /[0-9πe)]$/.test(prev || "");
  const needsStar = prev && startsWithFuncOrParen && prevEndsWithNumConstParen;

  if (k === "^2" || k === "^3") { displayInput.value += (prev ? "^" : "^") + k.slice(1); return; }

  displayInput.value += (needsStar ? "*" : "") + k;
  displayInput.scrollLeft = displayInput.scrollWidth;
}

function normalizeExpr(expr) {
  let s = String(expr).trim();
  s = s
    .replace(/÷/g,"/").replace(/×/g,"*").replace(/−/g,"-")
    .replace(/\^/g,"**")
    .replace(/π/g,"PI")
    .replace(/√\(/g,"SQRT(")
    .replace(/\blog\(/g,"LOG10(")
    .replace(/\bln\(/g,"LN(")
    .replace(/\bexp\(/g,"EXP(")
    .replace(/\bsin\(/g,"SIN(")
    .replace(/\bcos\(/g,"COS(")
    .replace(/\btan\(/g,"TAN(")
    .replace(/\basin\(/g,"ASIN(")
    .replace(/\bacos\(/g,"ACOS(")
    .replace(/\batan\(/g,"ATAN(")
    .replace(/\be\b/g,"E");

  // n! and percents
  s = s.replace(/(\d+|\))!/g,(_,g1)=>`FACT(${g1})`);
  s = s.replace(/(\d+(\.\d+)?)%/g,"($1/100)");

  // implicit mult
  s = s
    .replace(/(\d|\))\s*(\()/g,"$1*$2")
    .replace(/(\d|\))\s*(PI|E|SQRT|SIN|COS|TAN|ASIN|ACOS|ATAN|LN|LOG10|EXP)\b/g,"$1*$2")
    .replace(/(PI|E|\))\s*(\d|\()/g,"$1*$2");

  // map to Math / wrappers
  s = s
    .replace(/\bPI\b/g,"Math.PI")
    .replace(/\bE\b/g,"Math.E")
    .replace(/\bSQRT\(/g,"Math.sqrt(")
    .replace(/\bLN\(/g,"Math.log(")
    .replace(/\bLOG10\(/g,"Math.log10(")
    .replace(/\bEXP\(/g,"Math.exp(")
    .replace(/\bSIN\(/g,"__SIN__(")
    .replace(/\bCOS\(/g,"__COS__(")
    .replace(/\bTAN\(/g,"__TAN__(")
    .replace(/\bASIN\(/g,"__ASIN__(")
    .replace(/\bACOS\(/g,"__ACOS__(")
    .replace(/\bATAN\(/g,"__ATAN__(");

  return s;
}

function calculateExpression() {
  const raw = displayInput.value.trim();
  if (!raw) return;

  const norm = normalizeExpr(raw);
  try {
    const toRad = x => x * Math.PI / 180;
    const toDeg = x => x * 180 / Math.PI;
    const __SIN__  = x => DEG_MODE ? Math.sin(toRad(x)) : Math.sin(x);
    const __COS__  = x => DEG_MODE ? Math.cos(toRad(x)) : Math.cos(x);
    const __TAN__  = x => DEG_MODE ? Math.tan(toRad(x)) : Math.tan(x);
    const __ASIN__ = x => DEG_MODE ? toDeg(Math.asin(x)) : Math.asin(x);
    const __ACOS__ = x => DEG_MODE ? toDeg(Math.acos(x)) : Math.acos(x);
    const __ATAN__ = x => DEG_MODE ? toDeg(Math.atan(x)) : Math.atan(x);
    const FACT = (n)=>{ if(!isFinite(n))throw 0; n=Math.floor(n); if(n<0)throw 0; let r=1; for(let i=2;i<=n;i++) r*=i; return r; };

    const value = Function(
      "__SIN__", "__COS__", "__TAN__", "__ASIN__", "__ACOS__", "__ATAN__", "FACT",
      `"use strict"; return (${norm});`
    )(__SIN__, __COS__, __TAN__, __ASIN__, __ACOS__, __ATAN__, FACT);

    setRightPanel(value, [
      `Input: ${raw}`,
      `Normalized: ${norm}`,
      `Angle mode: ${DEG_MODE ? "Degrees" : "Radians"}`,
      `Result: ${value}`
    ], "Scientific evaluation");
    JUST_EVALUATED = true;
  } catch (e) {
    setRightPanel("Error", [`Input: ${raw}`, `Normalized: ${norm}`, `Could not evaluate`, e?.message||""], "Check syntax");
    JUST_EVALUATED = true;
  }
}

/* ========= Converter (v2: robust + optimized) ========= */

/** Smart number formatting */
function fmt(n){
  if (!isFinite(n)) return "";
  const abs = Math.abs(n);
  let out = (abs >= 1e-6 && abs < 1e9) ? n.toFixed(10) : n.toPrecision(12);
  out = out.replace(/(?:\.0+|(\.\d*?[1-9]))0+$/,'$1').replace(/\.$/, "");
  return out;
}

const UNIT_GROUPS = {
  length      : ["mm","cm","m","km","in","ft","yd","mi"],
  weight      : ["mg","g","kg","lb","oz"],
  temperature : ["C","F","K"],
  area        : ["mm²","cm²","m²","km²","ft²","yd²","mi²","acre","hectare"],
  volume      : ["ml","l","m³","cm³","ft³","in³","gal_us","gal_uk","pint","cup","tsp"],
  speed       : ["m/s","km/h","mph","knot","ft/s"],
  time        : ["ms","sec","min","hr","day","week","month","year"],
  dataSize    : ["bit","B","KB","MB","GB","TB","PB"],
  transferRate: ["bps","Kbps","Mbps","Gbps","Tbps"],
  currency    : ["USD","EUR","GBP","BDT","INR","CAD","AUD","JPY","AED","CNY"]
};

const __FACTORS__ = {
  length: { mm:1e-3, cm:1e-2, m:1, km:1e3, in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344 },
  weight: { mg:1e-6, g:1e-3, kg:1, lb:0.45359237, oz:0.028349523125 },
  area: {
    "mm²":1e-6, "cm²":1e-4, "m²":1, "km²":1e6,
    "ft²":0.09290304, "yd²":0.83612736, "mi²":2589988.110336,
    "acre":4046.8564224, "hectare":10000
  },
  volume: {
    ml:1e-3, l:1, "m³":1000, "cm³":1e-3,
    "ft³":28.316846592, "in³":0.016387064,
    gal_us:3.785411784, gal_uk:4.54609,
    pint:0.473176473, cup:0.24, tsp:0.005
  },
  speed: { "m/s":1, "km/h":1000/3600, mph:1609.344/3600, knot:1852/3600, "ft/s":0.3048 },
  time: { ms:1e-3, sec:1, min:60, hr:3600, day:86400, week:604800, month:2629800, year:31557600 },
  dataSize: { bit:1/8, B:1, KB:1024, MB:1024**2, GB:1024**3, TB:1024**4, PB:1024**5 },
  transferRate: { bps:1, Kbps:1e3, Mbps:1e6, Gbps:1e9, Tbps:1e12 }
};

/* Temperature helpers */
function tempToK(v,u){
  if (u==="C") return v+273.15;
  if (u==="F") return (v-32)*5/9+273.15;
  return v;
}
function tempFromK(v,u){
  if (u==="C") return v-273.15;
  if (u==="F") return (v-273.15)*9/5+32;
  return v;
}

function convertValue(cat, val, from, to) {
  if (!isFinite(val)) return NaN;
  if (from===to) return val;

  if (__FACTORS__[cat]) {
    const map = __FACTORS__[cat];
    if (!(from in map) || !(to in map)) return NaN;
    return val * map[from] / map[to];
  }
  if (cat==="temperature") {
    return tempFromK(tempToK(val, from), to);
  }
  return NaN;
}

/* ---- currency (live, cached with multi-API + fallback) ---- */
const FALLBACK_RATES_USD = {
  USD: 1, EUR: 0.92, GBP: 0.79, BDT: 119.0, INR: 83.2,
  CAD: 1.37, AUD: 1.52, JPY: 151.9, AED: 3.6725, CNY: 7.20
};
let __FX_CACHE__ = { base: "USD", time: 0, rates: null, source: "fallback" };

async function fetchFxRatesUSD() {
  const tryEndpoints = [
    async () => {
      const r = await fetch("https://api.exchangerate.host/latest?base=USD");
      const j = await r.json();
      if (j && j.rates) return { base: "USD", rates: j.rates, source: "exchangerate.host" };
      throw new Error("exchangerate.host bad payload");
    },
    async () => {
      const r = await fetch("https://api.frankfurter.app/latest?from=USD");
      const j = await r.json();
      if (j && j.rates) return { base: "USD", rates: j.rates, source: "frankfurter.app" };
      throw new Error("frankfurter.app bad payload");
    },
    async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const j = await r.json();
      if (j && j.rates) return { base: "USD", rates: j.rates, source: "open.er-api.com" };
      throw new Error("er-api bad payload");
    }
  ];

  for (const fn of tryEndpoints) {
    try {
      const out = await fn();
      return out;
    } catch (_) {}
  }
  return { base: "USD", rates: FALLBACK_RATES_USD, source: "fallback" };
}
async function ensureRates() {
  const now = Date.now();
  const maxAgeMs = 12 * 60 * 60 * 1000;
  if (__FX_CACHE__.rates && (now - __FX_CACHE__.time) < maxAgeMs) return __FX_CACHE__;
  const out = await fetchFxRatesUSD();
  __FX_CACHE__ = { ...out, time: Date.now() };
  return __FX_CACHE__;
}
function safeRate(rates, code) {
  const k = String(code || "").toUpperCase();
  if (k === "USD") return 1;
  return rates[k];
}
async function convertCurrency(val, from, to) {
  if (!isFinite(val)) return { value: NaN, source:"—", note:"Invalid input" };
  const { rates, source } = await ensureRates();
  const rFrom = safeRate(rates, from);
  const rTo   = safeRate(rates, to);
  if (!isFinite(rFrom) || !isFinite(rTo)) {
    return { value: val, source, note:"Rate missing; returned input unchanged." };
  }
  const inUSD = String(from).toUpperCase()==="USD" ? val : (val / rFrom);
  const out   = String(to).toUpperCase()==="USD" ? inUSD : (inUSD * rTo);
  return { value: out, source, note: source==="fallback" ? "Used fallback rates (offline)." : `Live rates: ${source}` };
}

/* ---------- UI binders for converter ---------- */
function populateUnits() {
  if (!convCategory) return;
  const cat = convCategory.value || "length";
  const list = UNIT_GROUPS[cat] || [];

  fromUnit.innerHTML = list.map(u=>`<option>${u}</option>`).join("");
  toUnit.innerHTML   = list.map(u=>`<option>${u}</option>`).join("");

  if (cat==="length")            { fromUnit.value="m";     toUnit.value="km"; }
  else if (cat==="weight")       { fromUnit.value="kg";    toUnit.value="lb"; }
  else if (cat==="temperature")  { fromUnit.value="C";     toUnit.value="F"; }
  else if (cat==="area")         { fromUnit.value="m²";    toUnit.value="ft²"; }
  else if (cat==="volume")       { fromUnit.value="l";     toUnit.value="m³"; }
  else if (cat==="speed")        { fromUnit.value="km/h";  toUnit.value="m/s"; }
  else if (cat==="time")         { fromUnit.value="hr";    toUnit.value="min"; }
  else if (cat==="dataSize")     { fromUnit.value="MB";    toUnit.value="GB"; }
  else if (cat==="transferRate") { fromUnit.value="Mbps";  toUnit.value="Kbps"; }
  else if (cat==="currency")     { fromUnit.value="USD";   toUnit.value="BDT"; }

  refreshCustomSelect?.(fromUnit);
  refreshCustomSelect?.(toUnit);
}

async function doConvert() {
  const cat = convCategory.value;
  const raw = parseFloat(fromValue.value);
  if (!isFinite(raw)) { toValue.value=""; return; }

  let out = NaN, note = "Unit conversion";

  if (cat === "currency") {
    const res = await convertCurrency(raw, fromUnit.value, toUnit.value);
    out = res.value; note = res.note;
  } else {
    out = convertValue(cat, raw, fromUnit.value, toUnit.value);
  }

  toValue.value = fmt(out);
  setRightPanel(out, [
    `Category: ${cat}`,
    `Convert ${fmt(raw)} ${fromUnit.value} → ${toUnit.value}`,
    `Result: ${fmt(out)}`
  ], note);
}

if (convCategory) {
  convCategory.innerHTML = Object.keys(UNIT_GROUPS).map(k=>`<option value="${k}">${k}</option>`).join("");
  convCategory.value = convCategory.value || "length";
  populateUnits();

  convCategory.addEventListener("change", () => {
    populateUnits();
    refreshCustomSelect?.(convCategory);
    toValue.value = "";
  });

  fromUnit.addEventListener("change", doConvert);
  toUnit.addEventListener("change", doConvert);
  fromValue.addEventListener("input", () => {
    clearTimeout(fromValue.__t);
    fromValue.__t = setTimeout(doConvert, 120);
  });

  convertBtn?.addEventListener("click", doConvert);
}

/* ========= Right panel ========= */
function setRightPanel(answer, stepsArr=[], note="—") {
  resultOutput && (resultOutput.textContent = String(answer));
  stepsBox && (stepsBox.textContent = stepsArr.length ? stepsArr.join("\n") : "No steps yet.");
  notesBox && (notesBox.textContent = note);
}
function setMeta(topic, formula) {
  detectedTopic && (detectedTopic.textContent = topic || "—");
  usedFormula && (usedFormula.textContent   = formula || "—");
}

/* ========= Suggestion bank ========= */
function suggestRephrase(topicKey){
  const bank = {
    percent: [
      "Find 25% of 240.",
      "Increase 400 by 12%.",
      "A shirt is 30% off the price 120. What is the sale price?"
    ],
    geometry: [
      "Area of triangle: base 8, height 6.",
      "Area of rectangle: length 10 cm, width 7 cm.",
      "Circumference of a circle with radius 4."
    ],
    sdt: [
      "A car moves at 60 km/h for 1.5 hours. Find the distance.",
      "Distance = 90 km, time = 1.5 hours. Find speed."
    ],
    money: [
      "Each notebook costs 15 taka. How much for 8 notebooks?",
      "Share 45 candies equally among 9 children."
    ],
    interest: [
      "Find simple interest on 6000 at 8% for 2 years."
    ],
    physics: [
      "Find force when mass = 4 kg and acceleration = 2.5 m/s^2.",
      "Given V=24 V and I=3 A, find R."
    ],
    conversion: [
      "Convert 12 km to m.",
      "Convert 40 C to F."
    ],
    generic: [
      "Try a short sentence like: 'Find 15% of 320' or 'Area of triangle: base 8 height 6'."
    ]
  };
  return bank[topicKey] || bank.generic;
}
function guessTopic(s){
  if (/\bpercent|%|discount|increase|decrease\b/.test(s)) return "percent";
  if (/\btriangle|rectangle|square|circle|radius|circumference|perimeter|area|height|length|width\b/.test(s)) return "geometry";
  if (/\bkm\/h|kmh|kmph|mph|m\/s|speed|distance|time|travels|moves|goes\b/.test(s)) return "sdt";
  if (/\bnotebook|taka|tk|usd|dollar|rupee|split|share\b/.test(s)) return "money";
  if (/\binterest|si\b/.test(s)) return "interest";
  if (/\bforce|mass|acceleration|voltage|current|resistance|ohm|Ω|m\/s\^?2\b/.test(s)) return "physics";
  if (/\bconvert\b/.test(s)) return "conversion";
  return "generic";
}

/* ========= AI Solvers ========= */
// Basic money/add/sub/share
function solveBasic(text){
  const s = normText(text);
  let m = s.match(/(?:each|per)\s+(?:item|book|pen|kg|meter|ticket|thing|one|piece)?\s*(?:costs?|is|price(?:d)?(?: at)?)\s*(-?\d+(?:\.\d+)?)\b.*?\b(?:for|buy|get)\s*(-?\d+(?:\.\d+)?)\b/);
  if (m) { const p=+m[1], q=+m[2], t=roundSmart(p*q); return { ok:true, answer:t, steps:[`Price per unit = ${p}`, `Quantity = ${q}`, `Total = ${p} × ${q} = ${t}`], topic:"Money", formula:"Total = price × quantity" }; }
  m = s.match(/\bhave\s*(-?\d+(?:\.\d+)?)\b.*?\b(get|got|receive|received|bought|buy|gain|add|added|more)\b.*?\b(-?\d+(?:\.\d+)?)\b/);
  if (m) { const a=+m[1], b=+m[3], r=roundSmart(a+b); return { ok:true, answer:r, steps:[`Start = ${a}`, `Gain = +${b}`, `Result = ${a} + ${b} = ${r}`], topic:"Addition", formula:"Result = start + gain" }; }
  m = s.match(/\bhave\s*(-?\d+(?:\.\d+)?)\b.*?\b(give|gave|lose|lost|spent|spend|pay|paid|remove|removed|subtract|subtracted)\b.*?\b(-?\d+(?:\.\d+)?)\b/);
  if (m) { const a=+m[1], b=+m[3], r=roundSmart(a-b); return { ok:true, answer:r, steps:[`Start = ${a}`, `Loss = -${b}`, `Result = ${a} - ${b} = ${r}`], topic:"Subtraction", formula:"Result = start − loss" }; }
  m = s.match(/(?:share|split|distribute)\s*(-?\d+(?:\.\d+)?)\s*(?:things|candies|apples|items|money|taka|tk|dollars?)?.*?\b(?:equally|among)\s*(-?\d+(?:\.\d+)?)\b/);
  if (m) { const total=+m[1], k=+m[2], each=roundSmart(total/k); return { ok:true, answer:each, steps:[`Total = ${total}`, `People = ${k}`, `Each = ${total} ÷ ${k} = ${each}`], topic:"Division", formula:"Each = total ÷ people" }; }
  return { ok:false };
}
// Percentage
function solvePercent(text){
  const s = normText(text);
  let m = s.match(/(\d+(\.\d+)?)\s*%\s*of\s*(\d+(\.\d+)?)/);
  if (m) { const p=+m[1], n=+m[3], r=roundSmart(n*(p/100)); return { ok:true, answer:r, steps:[`${p}% = ${p}/100`, `Multiply: ${n} × ${p/100} = ${r}`], topic:"Percentage", formula:"x% of N = (x/100) × N" }; }
  m = s.match(/(increase|decrease)\s+(\d+(\.\d+)?)\s+by\s+(\d+(\.\d+)?)\s*%/);
  if (m) { const op=m[1], base=+m[2], p=+m[4]; const delta=roundSmart(base*(p/100)); const out=roundSmart(op==="increase"? base+delta : base-delta); return { ok:true, answer:out, steps:[`Δ = ${p}% of ${base} = ${delta}`, `New = ${base} ${op==="increase"?"+":"-"} ${delta} = ${out}`], topic:"Percentage change", formula:"New = Base ± (p/100 × Base)" }; }
  m = s.match(/(?:discount|off)\s+(\d+(\.\d+)?)\s*%.*?(\d+(\.\d+)?)/);
  if (m) { const p=+m[1], price=+m[3], cut=roundSmart(price*(p/100)), res=roundSmart(price-cut); return { ok:true, answer:res, steps:[`Discount = ${p}% of ${price} = ${cut}`, `Sale = ${price} - ${cut} = ${res}`], topic:"Discount", formula:"Sale = Price − (p/100 × Price)" }; }
  return { ok:false };
}
// Geometry
function solveGeometry(text){
  const s = text.toLowerCase();
  let m = s.match(/rectangle.*?(?:length|l)\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s*[a-z]+)?[^]*?(?:width|breadth|w|b)\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s*[a-z]+)?/);
  if (m) { const l=+m[1], w=+m[2]; if (s.includes("perimeter")) { const p=2*(l+w); return { ok:true, answer:p, steps:[`P = 2(l+w)`, `P = 2(${l}+${w}) = ${p}`], topic:"Perimeter (Rectangle)", formula:"P = 2(l+w)" }; } const a=l*w; return { ok:true, answer:a, steps:[`A = l×w`, `A = ${l}×${w} = ${a}`], topic:"Area (Rectangle)", formula:"A = l × w" }; }
  m = s.match(/square.*?(?:side|edge|a)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
  if (m) { const a=+m[1]; if (s.includes("perimeter")) { const p=4*a; return { ok:true, answer:p, steps:[`P = 4a = 4×${a} = ${p}`], topic:"Perimeter (Square)", formula:"P = 4a" }; } const ar=a*a; return { ok:true, answer:ar, steps:[`A = a² = ${a}×${a} = ${ar}`], topic:"Area (Square)", formula:"A = a²" }; }
  m = s.match(/triangle[^]*?base\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s*[a-z]+)?[^]*?height\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s*[a-z]+)?/);
  if (!m) m = s.match(/area\s*of\s*triangle[^]*?base\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s*[a-z]+)?[^]*?height\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s*[a-z]+)?/);
  if (m) { const b=+m[1], h=+m[2], a=0.5*b*h; return { ok:true, answer:a, steps:[`A = 1/2 × b × h`, `A = 0.5×${b}×${h} = ${a}`], topic:"Area (Triangle)", formula:"A = 1/2 × b × h" }; }
  if (/\btriangle\b/.test(s) && /area/.test(s)) { const ns=numbersIn(s); if (ns.length>=2){ const b=+ns[0], h=+ns[1], a=0.5*b*h; return { ok:true, answer:a, steps:[`Assume base=${b}, height=${h}`, `A = 0.5×${b}×${h} = ${a}`], topic:"Area (Triangle)", formula:"A = 1/2 × b × h" }; } }
  m = s.match(/circle[^]*?radius\s*[:=]?\s*(\d+(?:\.\d+)?)/);
  if (m && /area/.test(s)) { const r=+m[1], a=Math.PI*r*r; return { ok:true, answer:a, steps:[`A = πr²`, `A = π×${r}² = ${a}`], topic:"Area (Circle)", formula:"A = πr²" }; }
  if (m && /(circumference|perimeter)/.test(s)) { const r=+m[1], c=2*Math.PI*r; return { ok:true, answer:c, steps:[`C = 2πr`, `C = 2×π×${r} = ${c}`], topic:"Circumference (Circle)", formula:"C = 2πr" }; }
  return { ok:false };
}
// Speed–Distance–Time
const toHours = (t,u)=>{ if(!u) return t; if(/^min/.test(u)) return t/60; if(/^s/.test(u)) return t/3600; return t; };
const normalizeSpeedUnit = (u)=>{ if(!u) return "km/h"; u=u.toLowerCase(); if (u==="m/s") return "m/s"; if (u==="mph") return "mph"; if (u==="km/h"||u==="kmh"||u==="kmph") return "km/h"; return "km/h"; };
function solveSDT(text){
  const s = normText(text);
  let m = s.match(/(?:moves|travels|goes)\s+at\s*(\d+(\.\d+)?)\s*(km\/h|kmh|kmph|m\/s|mph)?\s*(?:for|during)\s*(\d+(\.\d+)?)\s*(h|hr|hour|hours|min|minutes|s|sec|seconds)/);
  if (m) { let v=+m[1], vU=normalizeSpeedUnit(m[3]), t=+m[4], tU=m[6]; if (vU==="m/s") v*=3.6; if (vU==="mph") v*=1.609344; const hours=toHours(t,tU); const d=roundSmart(v*hours); return { ok:true, answer:`${d} km`, steps:[`Speed = ${v} km/h`, `Time = ${hours} h`, `d = v×t = ${d} km`], topic:"Speed–Distance–Time", formula:"d = v × t" }; }
  m = s.match(/(?:for|during)\s*(\d+(\.\d+)?)\s*(h|hr|hour|hours|min|minutes|s|sec|seconds)\s*(?:at)\s*(\d+(\.\d+)?)\s*(km\/h|kmh|kmph|m\/s|mph)/);
  if (m) { let t=+m[1], tU=m[3], v=+m[4], vU=normalizeSpeedUnit(m[6]); if (vU==="m/s") v*=3.6; if (vU==="mph") v*=1.609344; const hours=toHours(t,tU); const d=roundSmart(v*hours); return { ok:true, answer:`${d} km`, steps:[`Speed = ${v} km/h`, `Time = ${hours} h`, `d = v×t = ${d} km`], topic:"Speed–Distance–Time", formula:"d = v × t" }; }
  m = s.match(/speed\s*=?\s*(\d+(\.\d+)?)\s*(km\/h|kmh|kmph|m\/s|mph)?[^]*?time\s*=?\s*(\d+(\.\d+)?)\s*(h|hr|hours?|min|minutes?|s|sec|seconds?)/);
  if (m) { let v=+m[1], vUnit=normalizeSpeedUnit(m[3]||"km/h"), t=+m[4], tUnit=m[6]; if (vUnit==="m/s") v*=3.6; if (vUnit==="mph") v*=1.609344; const hours=toHours(t,tUnit); const d=roundSmart(v*hours); return { ok:true, answer:`${d} km`, steps:[`Speed = ${v} km/h`, `Time = ${hours} h`, `d = v×t = ${d} km`], topic:"Speed–Distance–Time", formula:"d = v × t" }; }
  m = s.match(/distance\s*=?\s*(\d+(\.\d+)?)\s*(km|m|mi)?[^]*?speed\s*=?\s*(\d+(\.\d+)?)/);
  if (m) { let d=+m[1], dUnit=m[3]||"km", v=+m[4]; if (dUnit==="m") d/=1000; if (dUnit==="mi") d*=1.609344; const time=roundSmart(d/v); return { ok:true, answer:`${time} h`, steps:[`d=${d} km`, `v=${v} km/h`, `t = d/v = ${time} h`], topic:"Speed–Distance–Time", formula:"t = d / v" }; }
  m = s.match(/distance\s*=?\s*(\d+(\.\d+)?)\s*(km|m|mi)?[^]*?time\s*=?\s*(\d+(\.\d+)?)\s*(h|hr|hours?|min|minutes?|s|sec|seconds?)/);
  if (m) { let d=+m[1], dUnit=m[3]||"km", t=+m[4], tUnit=m[6]; if (dUnit==="m") d/=1000; if (dUnit==="mi") d*=1.609344; const hours=toHours(t,tUnit); const v=roundSmart(d/hours); return { ok:true, answer:`${v} km/h`, steps:[`d=${d} km`, `t=${hours} h`, `v = d/t = ${v} km/h`], topic:"Speed–Distance–Time", formula:"v = d / t" }; }
  return { ok:false };
}
// Simple Interest
function solveSimpleInterest(text){
  const s = normText(text);
  let m = s.match(/(?:simple interest|si).*?(\d+(\.\d+)?).*?(\d+(\.\d+)?)\s*%.*?(\d+(\.\d+)?)(?:\s*(?:year|yr|y))/);
  if (!m) m = s.match(/find\s+(?:si|simple interest)\s+on\s+(\d+(\.\d+)?)\s+at\s+(\d+(\.\d+)?)\s*%\s+for\s+(\d+(\.\d+)?)\s*(?:year|yr|y)/);
  if (!m) return { ok:false };
  const P=+m[1], R=+m[3], T=+m[5], SI=roundSmart(P*R*T/100), A=roundSmart(P+SI);
  return { ok:true, answer:`SI = ${SI}, Amount = ${A}`, steps:[`P=${P}, R=${R}%, T=${T} years`, `SI = P×R×T/100 = ${P}×${R}×${T}/100 = ${SI}`, `A = P + SI = ${P} + ${SI} = ${A}`], topic:"Simple Interest", formula:"SI = PRT/100; A = P + SI" };
}
// Physics basics (broadened)
function solvePhysics(text){
  const s = normText(text);

  // F = m a
  let m = s.match(/(\d+(\.\d+)?)\s*kg[^]*?accelerat(?:es|ion)\s*(?:at|=)?\s*(\d+(\.\d+)?)\s*(?:m\/s\^?2|m\/s2|m\s*s-?2|ms-?2)/);
  if (m) {
    const mkg = +m[1], a = +m[3];
    const F = roundSmart(mkg * a);
    return { ok:true, answer:`${F} N`, steps:[`F = m × a`, `F = ${mkg} × ${a} = ${F} N`], topic:"Force", formula:"F = m × a" };
  }

  // F = m a explicit
  m = s.match(/mass\s*=?\s*(\d+(\.\d+)?)\s*(?:kg)?[^]*?accel(?:eration)?\s*=?\s*(\d+(\.\d+)?)\s*(?:m\/s\^?2|m\/s2|m\s*s-?2|ms-?2)/);
  if (m) {
    const mkg=+m[1], a=+m[3], F=roundSmart(mkg*a);
    return { ok:true, answer:`${F} N`, steps:[`F = m × a`, `F = ${mkg} × ${a} = ${F} N`], topic:"Force", formula:"F = m × a" };
  }

  // Ohm’s Law (R = V/I)
  m = s.match(/(?:voltage|v)\s*=?\s*(\d+(\.\d+)?)\s*(?:v)?[^]*?(?:current|i)\s*=?\s*(\d+(\.\d+)?)\s*(?:a)?/);
  if (m) {
    const V=+m[1], I=+m[3], R=roundSmart(V/I);
    return { ok:true, answer:`${R} Ω`, steps:[`R = V / I`, `R = ${V} / ${I} = ${R} Ω`], topic:"Ohm’s Law", formula:"R = V / I" };
  }

  // Ohm’s Law (V = I R) if they ask voltage
  m = s.match(/(?:current|i)\s*=?\s*(\d+(\.\d+)?)\s*(?:a)?[^]*?(?:resistance|r)\s*=?\s*(\d+(\.\d+)?)\s*(?:Ω|ohm)?/);
  if (m && /voltage|v\??/.test(s)) {
    const I=+m[1], Rv=+m[3], Vout=roundSmart(I*Rv);
    return { ok:true, answer:`${Vout} V`, steps:[`V = I × R`, `V = ${I} × ${Rv} = ${Vout} V`], topic:"Ohm’s Law", formula:"V = I × R" };
  }

  // Kinematics: v = u + a t
  m = s.match(/u\s*=?\s*(\d+(\.\d+)?)[^]*?a\s*=?\s*(\d+(\.\d+)?)[^]*?t\s*=?\s*(\d+(\.\d+)?)/);
  if (m) {
    const u=+m[1], a=+m[3], t=+m[5], v=roundSmart(u+a*t);
    return { ok:true, answer:v, steps:[`v = u + a t`, `v = ${u} + ${a}×${t} = ${v}`], topic:"Kinematics", formula:"v = u + a t" };
  }

  return { ok:false };
}
// Conversion in free text
function solveAIConversion(text){
  const m = normText(text).match(/convert\s+(\d+(\.\d+)?)\s*([a-z]+)\s+to\s+([a-z]+)/);
  if (!m) return { ok:false };
  const val=+m[1], from=m[3], to=m[4];
  let cat="length";
  if (["g","kg","lb","oz"].includes(from)||["g","kg","lb","oz"].includes(to)) cat="weight";
  if (["c","f","k"].includes(from)||["c","f","k"].includes(to)) cat="temperature";
  const res = convertValue(cat,val,from,to);
  return { ok:true, answer:res, steps:[`Category: ${cat}`, `Convert ${val} ${from} → ${to} = ${res}`], topic:"Unit conversion", formula:"—" };
}
// Direct calc fallback
function solveDirect(text){
  try {
    const norm = normalizeExpr(text);
    const toRad = x => x * Math.PI / 180;
    const toDeg = x => x * 180 / Math.PI;
    const __SIN__  = x => DEG_MODE ? Math.sin(toRad(x)) : Math.sin(x);
    const __COS__  = x => DEG_MODE ? Math.cos(toRad(x)) : Math.cos(x);
    const __TAN__  = x => DEG_MODE ? Math.tan(toRad(x)) : Math.tan(x);
    const __ASIN__ = x => DEG_MODE ? toDeg(Math.asin(x)) : Math.asin(x);
    const __ACOS__ = x => DEG_MODE ? toDeg(Math.acos(x)) : Math.acos(x);
    const __ATAN__ = x => DEG_MODE ? toDeg(Math.atan(x)) : Math.atan(x);
    const FACT = (n)=>{ if(!isFinite(n))throw 0; n=Math.floor(n); if(n<0)throw 0; let r=1; for(let i=2;i<=n;i++) r*=i; return r; };

    const val = Function(
      "__SIN__", "__COS__", "__TAN__", "__ASIN__", "__ACOS__", "__ATAN__", "FACT",
      `"use strict"; return (${norm});`
    )(__SIN__, __COS__, __TAN__, __ASIN__, __ACOS__, __ATAN__, FACT);

    return { ok:true, answer:val, steps:[`Normalized: ${norm}`, `Angle mode: ${DEG_MODE ? "Degrees" : "Radians"}`, `Result: ${val}`], topic:"Direct Calculation", formula:"—" };
  } catch { return { ok:false }; }
}

const SOLVERS = [ solveBasic, solvePercent, solveGeometry, solveSDT, solveSimpleInterest, solvePhysics, solveAIConversion, solveDirect ];

function solveAI(text) {
  for (const solver of SOLVERS) { const out = solver(text); if (out.ok) return out; }
  const topicKey = guessTopic(normText(text));
  const tips = suggestRephrase(topicKey);
  return {
    ok:true,
    answer:"—",
    steps:[`I couldn't confidently parse that phrasing.`, `Try one of these examples (adjust numbers):`, ...tips.map((t,i)=>`${i+1}. ${t}`)],
    topic:"Suggestion",
    formula:"—"
  };
}

/* ========= Topic picker (aligned to seed.jsonl) ========= */
const CLASS_TOPICS = {
  1: ["Addition", "Subtraction"],
  2: ["Money", "Time"],
  3: ["Multiplication", "Division"],
  4: ["Fractions", "Perimeter"],
  5: ["Decimals", "Area of Triangle"],
  6: ["Ratio", "Simple Interest", "Acids and Bases", "Magnetism"],
  7: ["Linear Equation", "Percent", "Speed Distance Time", "Force"],
  8: ["Simultaneous Equations", "Circle Area", "Density", "Work"],
  9: ["Quadratic", "Distance Formula", "Ohm's Law", "Reflection"],
  10:["Trigonometry", "AP Sum", "Newton's Second Law", "Lenses"]
};
function populateTopicsForClass() {
  if (!clsSelect || !topicSelect) return;
  const c = parseInt(clsSelect.value || clsSelect.options[clsSelect.selectedIndex]?.value, 10);
  const topics = CLASS_TOPICS[c] || ["General"];
  topicSelect.innerHTML = topics.map(t=>`<option>${t}</option>`).join("");
  refreshCustomSelect(topicSelect);
}
if (clsSelect && topicSelect) {
  populateTopicsForClass();
  clsSelect.addEventListener("change", ()=>{ populateTopicsForClass(); refreshCustomSelect(clsSelect); });
}

/* ========= Dataset loader / indexer ========= */
const DB = {
  items: [],
  byId: new Map(),
  byClass: new Map(),
  bySubject: new Map(),
  byTopic: new Map(),
};
async function loadJSONL(url) {
  const txt = await fetch(url).then(r => r.text());
  return txt
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(JSON.parse);
}
function indexItems(items){
  DB.items = items.slice();
  DB.byId.clear(); DB.byClass.clear(); DB.bySubject.clear(); DB.byTopic.clear();
  for (const raw of items) {
    const it = { ...raw, class: parseInt(raw.class, 10) }; // normalize class type
    DB.byId.set(it.id, it);
    if (!DB.byClass.has(it.class)) DB.byClass.set(it.class, []);
    if (!DB.bySubject.has(it.subject)) DB.bySubject.set(it.subject, []);
    if (!DB.byTopic.has(normText(it.topic))) DB.byTopic.set(normText(it.topic), []);
    DB.byClass.get(it.class).push(it);
    DB.bySubject.get(it.subject).push(it);
    DB.byTopic.get(normText(it.topic)).push(it);
  }
}

/* ========= Data expander ========= */
function expandDataIfSmall() {
  if (DB.items.length >= 100) return;

  const extra = [];
  for (let i=0;i<30;i++){
    const a = randInt(12, 98), b = randInt(2, 12);
    extra.push({
      id:`AUTO-MUL-${i}`,
      subject:"Math", class: clamp(Math.ceil(i/6)+3,1,10), topic:"Multiplication",
      question:`Find ${a} × ${b}.`,
      data:{a,b},
      solution:{steps:[`Compute: ${a} × ${b} = ${a*b}.`], final:String(a*b)}
    });
  }
  for (let i=0;i<30;i++){
    const b = randInt(6, 18), h = randInt(4, 15), area = 0.5*b*h;
    extra.push({
      id:`AUTO-TRI-${i}`,
      subject:"Math", class: clamp(Math.ceil(i/6)+5,1,10), topic:"Area of Triangle",
      question:`Find area of triangle: base = ${b} cm, height = ${h} cm.`,
      data:{b,h},
      solution:{steps:[`A = 1/2 × b × h = 0.5 × ${b} × ${h} = ${area}.`], final:String(area),},
      unit:"cm^2"
    });
  }
  for (let i=0;i<20;i++){
    const v = pick([30,40,45,50,60,72]), t = pick([1,1.5,2,2.5,3]), d = +(v*t).toFixed(2);
    extra.push({
      id:`AUTO-SDT-${i}`,
      subject:"Physics", class: clamp(Math.ceil(i/4)+7,1,10), topic:"Speed Distance Time",
      question:`A car moves at ${v} km/h for ${t} hours. Find the distance.`,
      data:{v,t},
      solution:{steps:[`d = v × t = ${v} × ${t} = ${d}.`], final:String(d)}, unit:"km"
    });
  }
  indexItems(DB.items.concat(extra));
}

/* ========= Similar examples (UI helper) ========= */
function getSimilarExamples({ cls, subject, topic, limit=3 }) {
  const pool = [];
  if (cls && DB.byClass.has(cls)) pool.push(...DB.byClass.get(cls));
  if (subject && DB.bySubject.has(subject)) pool.push(...DB.bySubject.get(subject));
  if (topic && DB.byTopic.has(normText(topic))) pool.push(...DB.byTopic.get(normText(topic)));
  const uniq = [];
  const seen = new Set();
  for (const it of pool) {
    if (seen.has(it.id)) continue;
    uniq.push(it); seen.add(it.id);
    if (uniq.length >= limit) break;
  }
  return uniq;
}

/* ========= Generator (DB-first, class-locked) ========= */
function genFromDB(cls, topic) {
  const c = parseInt(cls || 5, 10);
  const classPool = DB.byClass.get(c) || [];
  if (!classPool.length) return null;

  if (topic && topic.trim()) {
    const filtered = classPool.filter(it => topicMatches(it, topic));
    if (filtered.length) return pick(filtered);
    return null;
  }

  return pick(classPool);
}

/* ========= Procedural generators (backup) ========= */
function genPercentage(){ const base=randInt(80,400); const p=pick([10,12.5,15,20,25,30,40,50]); const ans=+(base*(p/100)).toFixed(2); return { problem:`Find ${p}% of ${base}.`, answer:ans, steps:[`${p}% = ${p}/100`, `Multiply: ${base} × ${p/100} = ${ans}`], concept:"Percentage of a number", tip:"Convert the percent to a decimal first." }; }
function genMoney(){ const price=pick([5,8,12,15,20]); const qty=randInt(2,12); const total=price*qty; return { problem:`Each notebook costs ${price} taka. How much for ${qty} notebooks?`, answer:`${total} taka`, steps:[`Price per item = ${price} taka`, `Quantity = ${qty}`, `Total = ${price} × ${qty} = ${total} taka`], concept:"Price × Quantity", tip:"Multiply the unit price by the number of items." }; }
function genRectangleArea(){ const l=randInt(5,18), w=randInt(4,15), a=l*w; return { problem:`Find the area of a rectangle with length ${l} cm and width ${w} cm.`, answer:`${a} cm²`, steps:[`A = l × w`, `A = ${l} × ${w}`, `A = ${a} cm²`], concept:"Area of rectangle", tip:"Multiply length by width." }; }
function genSpeed(){ const v=pick([30,40,45,50,60,72]); const t=pick([1,1.5,2,2.5,3]); const d=+(v*t).toFixed(2); return { problem:`A car moves at ${v} km/h for ${t} hours. Find the distance.`, answer:`${d} km`, steps:[`d = v × t`, `d = ${v} × ${t}`, `d = ${d} km`], concept:"Speed–Distance–Time", tip:"Distance equals speed times time." }; }
function genSimpleInterest(){ const P=pick([2000,4000,6000,8000,10000]); const R=pick([5,6,7.5,8,10]); const T=pick([1,2,3]); const SI=+(P*R*T/100).toFixed(2); const A=+(P+SI).toFixed(2); return { problem:`Find simple interest and total amount on ${P} taka at ${R}% for ${T} years.`, answer:`SI = ${SI} taka, Amount = ${A} taka`, steps:[`SI = P×R×T/100 = ${P}×${R}×${T}/100 = ${SI}`, `A = P + SI = ${P} + ${SI} = ${A}`], concept:"Simple Interest", tip:"Multiply P, R, T then divide by 100." }; }
function genOhm(){ const I=pick([0.5,1,1.5,2,2.5]); const R=pick([4,5,8,10,12,20]); const V=+(I*R).toFixed(2); return { problem:`Current is ${I} A and resistance is ${R} Ω. Find the voltage.`, answer:`${V} V`, steps:[`V = I × R`, `V = ${I} × ${R}`, `V = ${V} V`], concept:"Ohm’s Law", tip:"Voltage equals current times resistance." }; }
function genForce(){ const m = pick([3,4,5,6,8,10]); const a = pick([1,1.5,2,2.5,3]); const F = +(m*a).toFixed(2); return { problem:`A ${m} kg object accelerates at ${a} m/s^2. Find the net force.`, answer:`${F} N`, steps:[`F = m × a`, `F = ${m} × ${a} = ${F} N`], concept:"Newton's Second Law", tip:"Multiply mass by acceleration." }; }
function genLens(){ const f = pick([10,12,15,20]); const u = -pick([20,25,30,36,40]); const invV = (1/f) - (1/u); const v = +(1/invV).toFixed(2); return { problem:`A convex lens has focal length ${f} cm. An object is at ${-u} cm (take u = ${u} cm). Find image distance using 1/f = 1/v + 1/u.`, answer:`${v} cm`, steps:[`1/v = 1/f - 1/u`, `= 1/${f} - 1/(${u})`, `v = ${v} cm`], concept:"Thin Lens Formula", tip:"Use sign convention: real object → u is negative." }; }

function generateOne(cls, topic) {
  // Prefer DB question when available (class-locked)
  const fromDb = genFromDB(cls, topic);
  if (fromDb) {
    return {
      problem: fromDb.question,
      answer: fromDb.solution?.final ?? "—",
      steps: fromDb.solution?.steps ?? [],
      concept: fromDb.topic ?? "—",
      tip: fromDb.unit ? `Unit: ${fromDb.unit}` : "—"
    };
  }

  // Procedural: respect topic first
  const t = (topic || "").toLowerCase();
  if (t.includes("ohm"))             return genOhm();
  if (t.includes("speed") || t.includes("distance") || t.includes("time")) return genSpeed();
  if (t.includes("percent"))         return genPercentage();
  if (t.includes("money") || t.includes("price")) return genMoney();
  if (t.includes("area") || t.includes("rectangle") || t.includes("triangle") || t.includes("circle")) return genRectangleArea();
  if (t.includes("interest"))        return genSimpleInterest();
  if (t.includes("newton") || t.includes("force")) return genForce();
  if (t.includes("lens"))            return genLens();

  // Then grade-based mix
  const clsNum = parseInt(cls || 5, 10);
  if (clsNum <= 5) return pick([genPercentage, genMoney, genRectangleArea])();
  if (clsNum <= 7) return pick([genPercentage, genRectangleArea, genSpeed])();
  return pick([genOhm, genSimpleInterest, genSpeed, genForce])();
}

function toHintView(gen){ const steps=gen.steps.map((s,i)=>`Step ${i+1} Hint: ${s.replace(/^(Formula|Substitute|Compute|A =|P =|d =|F =|V =)\s*:\s*/,'')}`); return {...gen, steps, answer:"— (Reveal after trying)"}; }

/* ========= UI: Generate / Solve ========= */
genBtn?.addEventListener("click", ()=>{
  const cls=parseInt(clsSelect.value||5,10);
  const topic=topicSelect.value||"General";
  const mode=modeSelect.value||"solve";
  const g=generateOne(cls,topic);
  aiInput.value=g.problem;
  const preview=(mode==="hint")?toHintView(g):g;
  setMeta(topic+` (Class ${cls})`, preview.concept);
  setRightPanel(preview.answer, preview.steps, preview.tip);
});

solveBtn?.addEventListener("click", ()=>{
  const mode=modeSelect.value||"solve";
  const cls=parseInt(clsSelect.value||5,10);
  const topic=topicSelect.value||"General";
  const text=aiInput.value.trim();

  if (!text && (mode==="generate"||mode==="practice"||mode==="hint")) {
    const g=generateOne(cls, topic);
    aiInput.value=g.problem;
    if (mode==="hint") {
      const hint=toHintView(g);
      setMeta(topic+` (Class ${cls})`, hint.concept);
      setRightPanel(hint.answer, hint.steps, hint.tip);
      return;
    }
    if (mode==="practice") {
      const out=solveAI(g.problem);
      setMeta(out.topic||topic, out.formula||g.concept);
      setRightPanel(out.answer, out.steps, out.formula||g.tip);
      return;
    }
    setMeta(topic+` (Class ${cls})`, g.concept);
    setRightPanel(g.answer, g.steps, g.tip);
    return;
  }

  if (text) {
    const out=solveAI(text);
    setMeta(out.topic || topic, out.formula || "—");
    setRightPanel(out.answer, out.steps, out.formula || "—");
  }
});

clearAiBtn?.addEventListener("click", ()=>{
  aiInput.value=""; setMeta("—","—"); setRightPanel("—", ["No steps yet."], "—");
});

/* Fix long-press focus quirk on some devices */
aiInput?.addEventListener("pointerdown", ()=>{ if (document.activeElement!==aiInput) aiInput.focus(); });
aiInput?.addEventListener("mousedown", ()=>{ if (document.activeElement!==aiInput) aiInput.focus(); });

/* ========= Custom Select (accessible) ========= */
function enhanceAllSelects(){ $$('select[data-enhance="custom-select"]').forEach(enhanceSelect); }
function enhanceSelect(sel){
  if (!sel || sel.dataset.enhanced==="1") return;
  sel.dataset.enhanced="1";

  const wrapper=document.createElement("div");
  wrapper.className="selectbox";
  wrapper.setAttribute("data-for", sel.id);

  const btn=document.createElement("button");
  btn.type="button";
  btn.className="selectbox__button";
  btn.setAttribute("aria-haspopup","listbox");
  btn.setAttribute("aria-expanded","false");

  const labelSpan=document.createElement("span");
  labelSpan.textContent=sel.options[sel.selectedIndex]?.text || (sel.options[0]?.text || "Select");

  const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
  icon.setAttribute("viewBox","0 0 24 24");
  icon.classList.add("selectbox__icon");
  icon.innerHTML=`<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  btn.append(labelSpan, icon);

  const list=document.createElement("ul");
  list.className="selectbox__list";
  list.setAttribute("role","listbox");
  list.tabIndex=-1;

  function renderOptions(){
    list.innerHTML="";
    Array.from(sel.options).forEach((opt,i)=>{
      const li=document.createElement("li");
      li.className="selectbox__option";
      li.setAttribute("role","option");
      li.setAttribute("data-value", opt.value || opt.text);
      li.setAttribute("aria-selected", opt.selected ? "true":"false");
      li.textContent=opt.text;
      li.addEventListener("click", ()=>{ selectValue(opt.value||opt.text, opt.text, i); close(); });
      list.appendChild(li);
    });
  }
  function open(){ wrapper.classList.add("open"); btn.setAttribute("aria-expanded","true"); list.focus(); }
  function close({ restoreFocus = true } = {}){ wrapper.classList.remove("open"); btn.setAttribute("aria-expanded","false"); if (restoreFocus) btn.focus(); }
  function toggle(){ wrapper.classList.contains("open")?close():open(); }
  function selectValue(val,text,idx){
    sel.value=val;
    Array.from(sel.options).forEach((o,i)=>o.selected=i===idx);
    labelSpan.textContent=text;
    $$(".selectbox__option",wrapper).forEach(li=>li.setAttribute("aria-selected", li.getAttribute("data-value")===val?"true":"false"));
    sel.dispatchEvent(new Event("change",{bubbles:true}));
  }

  btn.addEventListener("click",toggle);
  btn.addEventListener("keydown",(e)=>{ if (e.key==="ArrowDown"||e.key==="Enter"||e.key===" ") { e.preventDefault(); open(); }});
  list.addEventListener("keydown",(e)=>{
    const opts=$$(".selectbox__option",wrapper);
    let idx=opts.findIndex(o=>o.getAttribute("aria-selected")==="true");
    if (e.key==="ArrowDown") { e.preventDefault(); idx=Math.min(idx+1,opts.length-1); opts[idx].click(); }
    if (e.key==="ArrowUp")   { e.preventDefault(); idx=Math.max(idx-1,0); opts[idx].click(); }
    if (e.key==="Escape")    { e.preventDefault(); close(); }
  });
  document.addEventListener("click",(e)=>{ if (!wrapper.contains(e.target)) close({ restoreFocus:false }); });
  renderOptions();
  wrapper.append(btn,list);
  sel.insertAdjacentElement("afterend", wrapper);
}
function refreshCustomSelect(sel){
  const wrap=document.querySelector(`.selectbox[data-for="${sel.id}"]`);
  if (!wrap) return;
  const labelSpan=wrap.querySelector(".selectbox__button span");
  const list=wrap.querySelector(".selectbox__list");
  list.innerHTML="";
  Array.from(sel.options).forEach((opt,i)=>{
    const li=document.createElement("li");
    li.className="selectbox__option";
    li.setAttribute("role","option");
    li.setAttribute("data-value", opt.value||opt.text);
    li.setAttribute("aria-selected", opt.selected?"true":"false");
    li.textContent=opt.text;
    li.addEventListener("click", ()=>{
      sel.value=opt.value||opt.text;
      Array.from(sel.options).forEach((o,j)=>o.selected=j===i);
      labelSpan.textContent=opt.text;
      $$(".selectbox__option",wrap).forEach(item=>item.setAttribute("aria-selected", item.getAttribute("data-value")===sel.value?"true":"false"));
      sel.dispatchEvent(new Event("change",{bubbles:true}));
      wrap.classList.remove("open");
      wrap.querySelector(".selectbox__button").setAttribute("aria-expanded","false");
    });
    list.appendChild(li);
  });
  labelSpan.textContent=sel.options[sel.selectedIndex]?.text || sel.value;
}

enhanceAllSelects();
/* =====================================
   Converter: Swap Units + Values + Toast
   ===================================== */
(() => {
  const swapBtn   = document.getElementById('convSwap');
  const toast     = document.getElementById('convSwapToast');
  const fromUnit  = document.getElementById('fromUnit');
  const toUnit    = document.getElementById('toUnit');
  const fromValue = document.getElementById('fromValue');
  const toValue   = document.getElementById('toValue');

  if (!swapBtn || !fromUnit || !toUnit || !fromValue || !toValue) return;

  function safeRefresh(el){ try { refreshCustomSelect?.(el); } catch {} }

  swapBtn.addEventListener('click', async () => {
    // spin animation
    swapBtn.classList.remove('spin'); swapBtn.offsetWidth; swapBtn.classList.add('spin');

    // swap units
    const u1 = fromUnit.value, u2 = toUnit.value;
    fromUnit.value = u2; toUnit.value = u1;
    safeRefresh(fromUnit); safeRefresh(toUnit);

    // if target has a number, use it as new input; else keep current input
    const hasTo = isFinite(parseFloat(toValue.value));
    if (hasTo) fromValue.value = toValue.value;

    // toast
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 900); }

    await doConvert();
  });
})();

/* ========= Init: load dataset, expand if small ========= */
(async () => {
  try {
    const items = await loadJSONL("seed.jsonl");
    indexItems(items);
    expandDataIfSmall();
  } catch (e) {
    console.warn("Could not load seed.jsonl — using procedural generation only.", e);
  }
  setMeta("—","—");
  setRightPanel("—",["No steps yet."],"—");
})();

/* ========= PWA Install ========= */
let deferredPrompt;
const installBtn = $("#installBtn");

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn?.classList.remove('hidden');
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBtn.classList.add('hidden');
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installBtn?.classList.add('hidden');
});

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
} // <-- this closing brace was missing

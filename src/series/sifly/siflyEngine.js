const STRIPS_PER_LOAD = 4;
const WAFERS_PER_STRIP = 4;
const GROUNDS_PER_WAFER = 9;
const POINTS_PER_STRIP = WAFERS_PER_STRIP * GROUNDS_PER_WAFER;
const CRITICALS = ["C2", "C3", "C4"];
const TEC_DOUBLE_TOL_CRITICALS = new Set(["C2", "C4"]);

function mean(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mapFileOrderToWafer1FirstPosition(positionInStrip) {
  const waferBlockFromFile = Math.floor(positionInStrip / GROUNDS_PER_WAFER); // 0..3 (file starts at wafer 4)
  const groundInWafer = positionInStrip % GROUNDS_PER_WAFER; // 0..8
  const waferNumber = WAFERS_PER_STRIP - waferBlockFromFile; // 4,3,2,1
  return (waferNumber - 1) * GROUNDS_PER_WAFER + groundInWafer; // wafer 1 now becomes points 1..9
}

function parseSifly(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    return null;
  }
  if (lines[0].split("\t")[0].replace(/"/g, "").trim() !== ":BEGIN") {
    return null;
  }

  let partPattern = "";
  let partDisplay = "";
  let dataStart = 1;
  const critRows = { C2: [], C3: [], C4: [] };
  const critSpecs = {
    C2: { lsl: null, usl: null },
    C3: { lsl: null, usl: null },
    C4: { lsl: null, usl: null }
  };

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    const noQuote = raw.replace(/"/g, "");
    if (/^PATTERN:/i.test(noQuote)) {
      partPattern = noQuote.split(/PATTERN:/i)[1].trim();
      dataStart = i + 1;
      continue;
    }
    if (/^DISPLAY:/i.test(noQuote)) {
      partDisplay = noQuote.split(/DISPLAY:/i)[1].trim();
      dataStart = i + 1;
      continue;
    }
    if (/^UNIT:/i.test(noQuote)) {
      dataStart = i + 1;
      continue;
    }
    const first = noQuote.split("\t")[0].trim();
    if (first && !first.includes(":")) {
      dataStart = i;
      break;
    }
  }

  for (let i = dataStart; i < lines.length; i += 1) {
    const parts = lines[i].split("\t").map((token) => token.replace(/"/g, "").trim());
    if (parts.length < 2) {
      continue;
    }
    const criticalToken = parts[0];
    if (!criticalToken || criticalToken === ":END" || criticalToken.startsWith(":")) {
      continue;
    }
    const critical = CRITICALS.find((name) => criticalToken.toUpperCase().startsWith(name));
    if (!critical) {
      continue;
    }
    const measured = Number.parseFloat(parts[1]);
    if (!Number.isFinite(measured)) {
      continue;
    }
    critRows[critical].push(measured);
    const nominal = Number.parseFloat(parts[2]);
    const plusTol = Number.parseFloat(parts[3]);
    const minusTol = Number.parseFloat(parts[4]);
    if (
      Number.isFinite(nominal) &&
      Number.isFinite(plusTol) &&
      Number.isFinite(minusTol) &&
      critSpecs[critical].lsl === null &&
      critSpecs[critical].usl === null
    ) {
      const multiplier = TEC_DOUBLE_TOL_CRITICALS.has(critical) ? 2 : 1;
      critSpecs[critical].lsl = nominal + minusTol * multiplier;
      critSpecs[critical].usl = nominal + plusTol * multiplier;
    }
  }

  const charts = CRITICALS.map((critical) => {
    const values = critRows[critical];
    const stripBuckets = Array.from({ length: STRIPS_PER_LOAD }, () =>
      Array.from({ length: POINTS_PER_STRIP }, () => [])
    );
    values.forEach((measured, idx) => {
      const strip = Math.floor(idx / POINTS_PER_STRIP) % STRIPS_PER_LOAD;
      const stripPosFromFile = idx % POINTS_PER_STRIP;
      const stripPos = mapFileOrderToWafer1FirstPosition(stripPosFromFile);
      stripBuckets[strip][stripPos].push(measured);
    });
    const stripLines = stripBuckets.map((bucket, stripIdx) => ({
      label: `Strip ${stripIdx + 1}`,
      values: bucket.map((points) => mean(points))
    }));
    return {
      critical,
      stripLines,
      lsl: critSpecs[critical].lsl,
      usl: critSpecs[critical].usl
    };
  });

  const xLabels = [];
  for (let pos = 0; pos < POINTS_PER_STRIP; pos += 1) {
    xLabels.push(String(pos + 1));
  }

  return {
    partPattern,
    partDisplay,
    charts,
    xLabels
  };
}

function drawLineChart(canvas, chartData, xLabels) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const margin = { left: 52, right: 14, top: 18, bottom: 36 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  ctx.clearRect(0, 0, width, height);

  const allValues = chartData.stripLines
    .flatMap((line) => line.values)
    .filter((value) => Number.isFinite(value));
  if (!allValues.length) {
    ctx.fillStyle = "#666";
    ctx.font = "12px Segoe UI";
    ctx.fillText("No valid data for this critical.", 12, height / 2);
    return;
  }

  const specValues = [chartData.lsl, chartData.usl].filter((value) => Number.isFinite(value));
  const min = Math.min(...allValues, ...specValues);
  const max = Math.max(...allValues, ...specValues);
  const range = Math.max(max - min, 0.001);
  const yMin = min - range * 0.08;
  const yMax = max + range * 0.08;

  const xAt = (idx) => margin.left + (idx / (xLabels.length - 1)) * plotW;
  const yAt = (value) => margin.top + ((yMax - value) / (yMax - yMin)) * plotH;

  ctx.fillStyle = "#fff";
  ctx.fillRect(margin.left, margin.top, plotW, plotH);
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = margin.top + (i / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + plotW, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#555";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotH);
  ctx.lineTo(margin.left + plotW, margin.top + plotH);
  ctx.stroke();

  function drawSpecLine(value, label) {
    if (!Number.isFinite(value)) {
      return;
    }
    const y = yAt(value);
    ctx.save();
    ctx.strokeStyle = "#c02020";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c02020";
    ctx.font = "bold 10px Segoe UI";
    ctx.textAlign = "left";
    ctx.fillText(`${label} ${value.toFixed(4)}`, margin.left + 6, y - 4);
    ctx.restore();
  }
  drawSpecLine(chartData.usl, "USL");
  drawSpecLine(chartData.lsl, "LSL");

  const palette = ["#1e4b8f", "#d9534f", "#2e8b57", "#7a4fbf"];
  chartData.stripLines.forEach((line, idx) => {
    ctx.strokeStyle = palette[idx % palette.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    let hasPoint = false;
    line.values.forEach((value, pointIndex) => {
      if (!Number.isFinite(value)) {
        return;
      }
      const x = xAt(pointIndex);
      const y = yAt(value);
      if (!hasPoint) {
        ctx.moveTo(x, y);
        hasPoint = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    if (hasPoint) {
      ctx.stroke();
    }
  });

  ctx.fillStyle = "#222";
  ctx.font = "10px Segoe UI";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const value = yMax - ((yMax - yMin) * i) / 4;
    const y = margin.top + (i / 4) * plotH + 3;
    ctx.fillText(value.toFixed(4), margin.left - 6, y);
  }

  ctx.textAlign = "center";
  [0, 8, 17, 26, 35].forEach((idx) => {
    const x = xAt(idx);
    ctx.fillText(xLabels[idx], x, margin.top + plotH + 14);
  });
}

function renderLegend(target) {
  const legend = document.createElement("div");
  legend.className = "sifly-legend";
  const labels = ["Strip 1", "Strip 2", "Strip 3", "Strip 4"];
  const palette = ["#1e4b8f", "#d9534f", "#2e8b57", "#7a4fbf"];
  labels.forEach((label, idx) => {
    const item = document.createElement("div");
    item.className = "sifly-legend-item";
    item.innerHTML = `<span class="sifly-swatch" style="background:${palette[idx]}"></span>${label}`;
    legend.appendChild(item);
  });
  target.appendChild(legend);
}

export function renderSiflyPlaceholder(content, fileName, legacy) {
  const parsed = parseSifly(content);
  if (!parsed) {
    legacy.showError("Could not parse Sifly file. Verify the file is in Vertex :BEGIN/:END format.");
    return;
  }

  const part = parsed.partPattern || parsed.partDisplay || "Sifly";
  const results = document.getElementById("results");
  results.innerHTML = "";

  const strip = document.createElement("div");
  strip.className = "info-strip";
  strip.innerHTML = `
    <div class="info-item"><span class="info-label">Part Number</span><span class="info-value">${part}</span></div>
    <div class="info-div"></div>
    <div class="info-item"><span class="info-label">File</span><span class="info-value" style="font-size:11px;color:#444">${fileName}</span></div>
    <div class="info-div"></div>
    <div class="info-item info-note"><span class="info-label">Layout</span><span class="info-value">4 strips, 4 wafers/strip, 9 vertical grounds/wafer</span></div>
    <div class="info-div"></div>
    <div class="info-item info-note"><span class="info-label">Active TEC</span><span class="info-value">Temporary engineering change: C2 and C4 use doubled upper/lower tolerance.</span></div>
  `;
  results.appendChild(strip);

  parsed.charts.forEach((chartData) => {
    const page = document.createElement("div");
    page.className = "minitab-page";
    const title = document.createElement("div");
    title.className = "minitab-title";
    title.innerHTML = `<div class="main">Sifly ${chartData.critical} by Strip Position</div>
      <div class="sub">X-axis points 1 through 36 (wafer 1 first)</div>`;
    page.appendChild(title);

    const body = document.createElement("div");
    body.style.padding = "12px";
    const canvas = document.createElement("canvas");
    canvas.width = 980;
    canvas.height = 280;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    body.appendChild(canvas);
    renderLegend(body);
    page.appendChild(body);
    results.appendChild(page);
    drawLineChart(canvas, chartData, parsed.xLabels);
  });

  results.style.display = "block";
  document.getElementById("upload-wrap").style.display = "none";
  document.getElementById("hdr-actions").style.display = "flex";
  document.getElementById("hdr-part").textContent = part;
}

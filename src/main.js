import { pickSeriesHandler } from "./core/seriesRouter.js";
import { accelerateSeries } from "./series/accelerate/accelerateIndex.js";
import { siflySeries } from "./series/sifly/siflyIndex.js";

const handlers = [accelerateSeries, siflySeries];
const FORCE_ACCELERATE_ROUTING = true;

function getLegacyBridge() {
  if (!window.ProductionChartsLegacy) {
    throw new Error("Legacy bridge is not initialized.");
  }
  return window.ProductionChartsLegacy;
}

function processFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const legacy = getLegacyBridge();
    legacy.hideError();
    try {
      const content = String(event.target?.result || "");
      const { partText, handler } = pickSeriesHandler(content, handlers);
      const selectedHandler = FORCE_ACCELERATE_ROUTING ? accelerateSeries : handler;
      if (!selectedHandler) {
        legacy.showError(
          `Unrecognized part series${partText ? ` (${partText})` : ""}. Supported series: Accelerate (APM6/APF6/ADF6/ADM6) and Sifly.`
        );
        return;
      }
      selectedHandler.renderFromFileContent(content, file.name, legacy);
    } catch (error) {
      legacy.showError(`Parse error: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function initUploadWiring() {
  const dz = document.getElementById("dropzone");
  const fi = document.getElementById("file-input");

  dz.addEventListener("dragover", (event) => {
    event.preventDefault();
    dz.classList.add("drag");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", (event) => {
    event.preventDefault();
    dz.classList.remove("drag");
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  });
  fi.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  });
}

initUploadWiring();

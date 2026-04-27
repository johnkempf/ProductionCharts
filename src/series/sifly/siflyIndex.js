import { renderSiflyPlaceholder } from "./siflyEngine.js";

export const siflySeries = {
  id: "sifly",
  label: "Sifly",
  matchesPart(partText) {
    return partText.includes("SUB-");
  },
  renderFromFileContent(content, fileName, legacy) {
    renderSiflyPlaceholder(content, fileName, legacy);
  }
};

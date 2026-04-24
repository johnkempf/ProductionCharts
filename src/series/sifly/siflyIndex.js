import { renderSiflyPlaceholder } from "./siflyEngine.js";

export const siflySeries = {
  id: "sifly",
  label: "Sifly",
  matchesPart(partText) {
    return partText.startsWith("SIFLY-");
  },
  renderFromFileContent(_content, _fileName, legacy) {
    renderSiflyPlaceholder(legacy);
  }
};

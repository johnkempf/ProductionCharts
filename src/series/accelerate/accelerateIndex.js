const ACCELERATE_PREFIXES = ["APM6-", "APF6-", "ADF6-", "ADM6-"];

function isAcceleratePart(partText) {
  return ACCELERATE_PREFIXES.some((prefix) => partText.startsWith(prefix));
}

export const accelerateSeries = {
  id: "accelerate",
  label: "Accelerate",
  matchesPart(partText) {
    return isAcceleratePart(partText);
  },
  renderFromFileContent(content, fileName, legacy) {
    const parsed = legacy.parseVertex(content);
    if (!parsed || !parsed.points || !parsed.points.length) {
      legacy.showError(
        "Could not find measurement data. Verify the file is in Vertex :BEGIN/:END format."
      );
      return;
    }
    legacy.renderResults(parsed, fileName);
  }
};

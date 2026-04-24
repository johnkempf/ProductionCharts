function normalizePartText(value) {
  return (value || "").toString().trim().toUpperCase();
}

export function detectSeriesFromContent(content) {
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines.slice(0, 50)) {
    const line = rawLine.replace(/"/g, "").trim();
    if (!line) {
      continue;
    }

    const patternMatch = line.match(/PATTERN:\s*(.+)$/i);
    if (patternMatch) {
      return normalizePartText(patternMatch[1]);
    }

    const displayMatch = line.match(/DISPLAY:\s*(.+)$/i);
    if (displayMatch) {
      return normalizePartText(displayMatch[1]);
    }
  }
  return "";
}

export function pickSeriesHandler(content, handlers) {
  const partText = detectSeriesFromContent(content);
  const handler = handlers.find((candidate) => candidate.matchesPart(partText));
  return { partText, handler: handler || null };
}

// Lucide icon SVGs — https://lucide.dev/icons/
// Inlined to avoid bundler issues with the lucide package

const ns = "http://www.w3.org/2000/svg";

function svg(paths: string, size: number): SVGElement {
  const el = document.createElementNS(ns, "svg");
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", "currentColor");
  el.setAttribute("stroke-width", "1.75");
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  el.innerHTML = paths;
  return el;
}

export function chevronRight(size = 15) {
  return svg('<path d="m9 18 6-6-6-6"/>', size);
}

export function chevronDown(size = 15) {
  return svg('<path d="m6 9 6 6 6-6"/>', size);
}

export function fileText(size = 15) {
  return svg(
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
    '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>' +
    '<path d="M10 13H8"/><path d="M16 17H8"/><path d="M16 13h-2"/>',
    size,
  );
}

export function folder(size = 15) {
  return svg(
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    size,
  );
}

export function folderOpen(size = 15) {
  return svg(
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    size,
  );
}

export function copy(size = 15) {
  return svg(
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
    '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    size,
  );
}

export function check(size = 15) {
  return svg('<path d="M20 6 9 17l-5-5"/>', size);
}

export function iconChevronUp(size = 15) {
  return svg('<path d="m18 15-6-6-6 6"/>', size);
}

export function iconChevronDown(size = 15) {
  return svg('<path d="m6 9 6 6 6-6"/>', size);
}

export function iconX(size = 15) {
  return svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', size);
}

export function plus(size = 15) {
  return svg('<path d="M5 12h14"/><path d="M12 5v14"/>', size);
}

export function pencil(size = 15) {
  return svg(
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>' +
    '<path d="m15 5 4 4"/>',
    size,
  );
}

export function trash(size = 15) {
  return svg(
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>' +
    '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    size,
  );
}

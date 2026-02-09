export interface MenuItem {
  label: string;
  icon?: SVGElement;
  danger?: boolean;
  action: () => void;
}

let currentMenu: HTMLElement | null = null;

function dismiss() {
  if (currentMenu) {
    currentMenu.remove();
    currentMenu = null;
  }
  document.removeEventListener("mousedown", onOutsideClick);
  document.removeEventListener("keydown", onEscape);
}

function onOutsideClick(e: MouseEvent) {
  if (currentMenu && !currentMenu.contains(e.target as Node)) {
    dismiss();
  }
}

function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    dismiss();
  }
}

export function showContextMenu(x: number, y: number, items: MenuItem[]) {
  dismiss();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  menu.dataset.testid = "context-menu";

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "context-menu-item";
    row.setAttribute("role", "menuitem");
    row.dataset.testid = `context-menu-${item.label.toLowerCase().replace(/\s+/g, "-")}`;
    if (item.danger) row.classList.add("danger");

    if (item.icon) row.appendChild(item.icon);

    const label = document.createElement("span");
    label.textContent = item.label;
    row.appendChild(label);

    row.addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss();
      item.action();
    });

    menu.appendChild(row);
  }

  // Position: ensure menu stays within viewport
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 4}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 4}px`;
  }

  currentMenu = menu;

  // Defer listeners so the triggering right-click doesn't immediately dismiss
  requestAnimationFrame(() => {
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  });
}

export function dismissContextMenu() {
  dismiss();
}

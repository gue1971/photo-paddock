const FAVORITES_KEY = "photo-paddock:favorites:v3";
const REPRESENTATIVES_KEY = "photo-paddock:representatives:v1";
const VIEW_MODE_KEY = "photo-paddock:view-mode";
const COMMENT_FONT_KEY = "photo-paddock:comment-font-size";
const STORAGE_EXPORT_VERSION = 1;
const VIEW_MODES = ["two", "one", "oneComments"];
const COMMENT_FONT_SIZES = ["normal", "large"];

const state = {
  db: null,
  mode: "favorites",
  selectedHorseId: "",
  selectedRaceKey: "",
  offspringHorseId: "",
  query: "",
  viewMode: loadViewMode(),
  commentFontSize: loadCommentFontSize(),
  sidebarOpen: false,
  filterOpen: false,
  openRaceYears: new Set(),
  favorites: new Set(loadFavoriteIds()),
  representatives: loadRepresentatives(),
  filters: {
    horseTouch: "",
    raceG1Only: false,
    raceYear: "",
    raceName: "",
    favoriteTouch: ""
  },
  undoFavorite: null,
  undoTimer: 0
};

const G1_RACES = [
  "フェブラリーS",
  "高松宮記念",
  "大阪杯",
  "桜花賞",
  "皐月賞",
  "天皇賞・春",
  "NHKマイルカップ",
  "ヴィクトリアマイル",
  "オークス",
  "日本ダービー",
  "安田記念",
  "宝塚記念",
  "スプリンターズS",
  "秋華賞",
  "菊花賞",
  "天皇賞・秋",
  "エリザベス女王杯",
  "マイルCS",
  "ジャパンカップ",
  "チャンピオンズカップ",
  "阪神ジュベナイルF",
  "朝日杯FS",
  "ホープフルS",
  "有馬記念"
];

const HORSE_TOUCH_LIMIT = 42;
const KANA_PAD_ROWS = [
  ["ア", "イ", "ウ", "エ", "オ"],
  ["カ", "キ", "ク", "ケ", "コ"],
  ["サ", "シ", "ス", "セ", "ソ"],
  ["タ", "チ", "ツ", "テ", "ト"],
  ["ナ", "ニ", "ヌ", "ネ", "ノ"],
  ["ハ", "ヒ", "フ", "ヘ", "ホ"],
  ["マ", "ミ", "ム", "メ", "モ"],
  ["ヤ", "ユ", "ヨ", "ラ", "リ", "ル", "レ", "ロ", "ワ", "ン"],
  ["ー"],
  ["A", "B", "C", "D", "E", "F", "G", "L", "M", "P", "S", "T"]
];

const itemList = document.querySelector("#itemList");
const detail = document.querySelector("#detail");
const summary = document.querySelector("#summary");
const search = document.querySelector("#search");
const filterControls = document.querySelector("#filterControls");
const toggleFilter = document.querySelector("#toggleFilter");
const modeHorse = document.querySelector("#modeHorse");
const modeRace = document.querySelector("#modeRace");
const modeFavorites = document.querySelector("#modeFavorites");
const toggleComments = document.querySelector("#toggleComments");
const toggleSidebar = document.querySelector("#toggleSidebar");
const toggleStorage = document.querySelector("#toggleStorage");
const storageMenu = document.querySelector("#storageMenu");
const storageInfo = document.querySelector("#storageInfo");
const exportStorage = document.querySelector("#exportStorage");
const importStorage = document.querySelector("#importStorage");
const toast = document.querySelector("#toast");

const appUrl = new URL(import.meta.url);
const dataUrl = appUrl.pathname.includes("/public/")
  ? new URL("../data/photo-paddock.json", appUrl)
  : new URL("./data/photo-paddock.json", appUrl);
const response = await fetch(dataUrl);
state.db = await response.json();
registerServiceWorker();

summary.textContent = `${state.db.horses.length}頭 / ${state.db.photos.length}枚 / ${races().length}レース / 取得ページ ${state.db.pages.length}件`;
search.placeholder = "お気に入りを入力検索";
render();

search.addEventListener("input", () => {
  state.query = search.value.trim();
  if (state.query) state.sidebarOpen = true;
  if (state.mode === "horse") {
    const exact = state.db.horses.find((horse) => horse.name === state.query);
    if (exact) {
      state.selectedHorseId = exact.id;
      state.filters.horseTouch = "";
      state.query = "";
      search.value = "";
    }
  }
  render();
});

filterControls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter-action]");
  if (!button) return;
  applyFilterAction(button.dataset.filterAction, button.dataset.value || "");
  render();
});

filterControls.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-filter-action]");
  if (!select) return;
  applyFilterAction(select.dataset.filterAction, select.value);
  render();
});

modeHorse.addEventListener("click", () => setMode("horse"));
modeRace.addEventListener("click", () => setMode("race"));
modeFavorites.addEventListener("click", () => setMode("favorites"));
toggleFilter.addEventListener("click", () => {
  state.filterOpen = !state.filterOpen;
  render();
});
toggleComments.addEventListener("click", () => {
  state.viewMode = nextViewMode();
  localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
  render();
});
toggleSidebar?.addEventListener("click", () => {
  state.sidebarOpen = !state.sidebarOpen;
  render();
});
toggleStorage?.addEventListener("click", () => {
  const open = storageMenu?.hidden;
  if (storageMenu) storageMenu.hidden = !open;
  toggleStorage.classList.toggle("active", Boolean(open));
  if (open) renderSettingsMenu();
});
exportStorage?.addEventListener("click", exportStorageData);
importStorage?.addEventListener("change", importStorageData);
storageMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-comment-font-size]");
  if (!button) return;
  setCommentFontSize(button.dataset.commentFontSize);
});

detail.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-favorite-photo-id]");
  if (button) {
    toggleFavorite(button.dataset.favoritePhotoId);
    return;
  }

  const representativeButton = event.target.closest("button[data-representative-photo-id]");
  if (representativeButton) {
    setRepresentative(representativeButton.dataset.representativePhotoId);
    return;
  }

  const raceLink = event.target.closest("button[data-open-race-key]");
  if (raceLink) {
    openRace(raceLink.dataset.openRaceKey);
    return;
  }

  const horseLink = event.target.closest("button[data-open-horse-id]");
  if (horseLink) {
    openHorse(horseLink.dataset.openHorseId);
    return;
  }

  const offspringLink = event.target.closest("button[data-open-offspring-id]");
  if (offspringLink) {
    openOffspring(offspringLink.dataset.openOffspringId);
  }
});

toast.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-undo-favorite]");
  if (!button || !state.undoFavorite) return;
  const photo = state.db.photos.find((item) => item.key === state.undoFavorite.photoKey);
  state.favorites.add(state.undoFavorite.photoKey);
  if (photo) {
    state.representatives[photo.horseId] = photo.key;
    saveRepresentatives();
  }
  saveFavorites();
  clearUndoFavorite();
  render();
});

function exportStorageData() {
  const data = {
    app: "photo-paddock",
    version: STORAGE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    favorites: [...state.favorites],
    representatives: state.representatives,
    viewMode: state.viewMode,
    commentFontSize: state.commentFontSize
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  link.href = url;
  link.download = `photo-paddock-storage-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  closeStorageMenu();
  showPlainToast(`保存データを書き出しました（お気に入り ${state.favorites.size}枚）`);
}

async function importStorageData() {
  const file = importStorage?.files?.[0];
  if (importStorage) importStorage.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== "photo-paddock" || !Array.isArray(data.favorites)) {
      throw new Error("invalid backup");
    }
    const before = state.favorites.size;
    for (const photoKey of data.favorites) {
      if (typeof photoKey === "string") state.favorites.add(photoKey);
    }
    if (data.representatives && typeof data.representatives === "object" && !Array.isArray(data.representatives)) {
      state.representatives = { ...state.representatives, ...data.representatives };
    }
    if (VIEW_MODES.includes(data.viewMode)) {
      state.viewMode = data.viewMode;
      localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
    } else if (typeof data.showComments === "boolean") {
      state.viewMode = data.showComments ? "oneComments" : "two";
      localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
    }
    if (COMMENT_FONT_SIZES.includes(data.commentFontSize)) setCommentFontSize(data.commentFontSize, false);
    saveFavorites();
    saveRepresentatives();
    clearUndoFavorite();
    render();
    closeStorageMenu();
    showPlainToast(`保存データを読み込みました（追加 ${state.favorites.size - before}枚 / 合計 ${state.favorites.size}枚）`);
  } catch {
    closeStorageMenu();
    showPlainToast("保存データを読み込めませんでした");
  }
}

function closeStorageMenu() {
  if (storageMenu) storageMenu.hidden = true;
  toggleStorage?.classList.remove("active");
}

function loadFavoriteIds() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
}

function loadRepresentatives() {
  try {
    const value = JSON.parse(localStorage.getItem(REPRESENTATIVES_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function saveRepresentatives() {
  localStorage.setItem(REPRESENTATIVES_KEY, JSON.stringify(state.representatives));
}

function loadViewMode() {
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  if (VIEW_MODES.includes(saved)) return saved;
  return "two";
}

function loadCommentFontSize() {
  const saved = localStorage.getItem(COMMENT_FONT_KEY);
  if (COMMENT_FONT_SIZES.includes(saved)) return saved;
  return "normal";
}

function setCommentFontSize(size, shouldRender = true) {
  if (!COMMENT_FONT_SIZES.includes(size)) return;
  state.commentFontSize = size;
  localStorage.setItem(COMMENT_FONT_KEY, size);
  if (shouldRender) render();
}

function nextViewMode() {
  const index = VIEW_MODES.indexOf(state.viewMode);
  return VIEW_MODES[(index + 1) % VIEW_MODES.length] || "two";
}

function viewModeLabel() {
  if (state.viewMode === "oneComments") return "一列コメント付き";
  if (state.viewMode === "one") return "一列";
  return "二列";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = new URL("./sw.js", appUrl);
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}

function toggleFavorite(photoKey) {
  if (!photoKey) return;
  const photo = state.db.photos.find((item) => item.key === photoKey);
  if (state.favorites.has(photoKey)) {
    state.favorites.delete(photoKey);
    if (photo && state.representatives[photo.horseId] === photo.key) {
      const nextFavorite = favoritePhotosForHorse(photo.horseId).find((item) => item.key !== photo.key);
      if (nextFavorite) state.representatives[photo.horseId] = nextFavorite.key;
      else delete state.representatives[photo.horseId];
      saveRepresentatives();
    }
    saveFavorites();
    showUndoFavorite(photoKey);
  } else {
    state.favorites.add(photoKey);
    if (photo) {
      state.representatives[photo.horseId] = photo.key;
      saveRepresentatives();
    }
    saveFavorites();
    clearUndoFavorite();
  }
  render();
}

function setRepresentative(photoKey) {
  const photo = state.db.photos.find((item) => item.key === photoKey);
  if (!photo) return;
  const hasFavorites = favoritePhotosForHorse(photo.horseId).length > 0;
  if (hasFavorites && !state.favorites.has(photo.key)) return;
  state.representatives[photo.horseId] = photo.key;
  saveRepresentatives();
  render();
}

function showUndoFavorite(photoKey) {
  const photo = state.db.photos.find((item) => item.key === photoKey);
  const horse = horseById(photo?.horseId);
  state.undoFavorite = { photoKey };
  window.clearTimeout(state.undoTimer);
  toast.hidden = false;
  toast.innerHTML = `
    <span>${escapeHtml(horse?.name || "写真")}のお気に入りを外しました</span>
    <button type="button" data-undo-favorite>取消</button>
  `;
  state.undoTimer = window.setTimeout(clearUndoFavorite, 5000);
}

function clearUndoFavorite() {
  window.clearTimeout(state.undoTimer);
  state.undoTimer = 0;
  state.undoFavorite = null;
  toast.hidden = true;
  toast.innerHTML = "";
}

function showPlainToast(message) {
  window.clearTimeout(state.undoTimer);
  state.undoTimer = window.setTimeout(clearUndoFavorite, 4000);
  state.undoFavorite = null;
  toast.hidden = false;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
}

function setMode(mode) {
  const changed = state.mode !== mode;
  state.mode = mode;
  if (mode !== "horse") state.offspringHorseId = "";
  if (changed) {
    state.query = "";
    search.value = "";
    state.filterOpen = false;
    state.sidebarOpen = false;
    if (mode === "horse" && !state.selectedHorseId) {
      state.selectedHorseId = firstFavoriteHorseId() || "";
    }
  }
  search.placeholder = mode === "race" ? "レース名を入力検索" : mode === "favorites" ? "お気に入りを入力検索" : "馬名・父・母を入力検索";
  search.removeAttribute("list");
  render();
}

function applyFilterAction(action, value) {
  if (action === "filter:close") {
    state.filterOpen = false;
    return;
  }
  if (action === "horse:append") {
    state.filters.horseTouch += value;
    state.selectedHorseId = "";
    state.sidebarOpen = true;
    return;
  }
  if (action === "horse:back") {
    state.filters.horseTouch = state.filters.horseTouch.slice(0, -1);
    state.selectedHorseId = "";
    state.sidebarOpen = true;
    return;
  }
  if (action === "horse:clear") {
    state.filters.horseTouch = "";
    state.selectedHorseId = "";
    return;
  }
  if (action === "favorite:append") {
    state.filters.favoriteTouch += value;
    return;
  }
  if (action === "favorite:back") {
    state.filters.favoriteTouch = state.filters.favoriteTouch.slice(0, -1);
    return;
  }
  if (action === "favorite:clear") {
    state.filters.favoriteTouch = "";
    return;
  }
  if (action === "race:class") {
    state.filters.raceG1Only = value === "G1" ? !state.filters.raceG1Only : false;
    state.filters.raceName = "";
    state.selectedRaceKey = "";
    return;
  }
  if (action === "race:clear") {
    state.query = "";
    search.value = "";
    state.filters.raceG1Only = false;
    state.filters.raceYear = "";
    state.filters.raceName = "";
    return;
  }
  if (action === "race:year") {
    state.filters.raceYear = value;
    state.selectedRaceKey = "";
    return;
  }
  if (action === "race:name") {
    state.filters.raceName = state.filters.raceName === value ? "" : value;
    state.selectedRaceKey = "";
  }
}

function openHorse(horseId) {
  const previousMode = state.mode;
  state.mode = "horse";
  state.selectedHorseId = horseId;
  state.offspringHorseId = "";
  state.filterOpen = false;
  state.filters.horseTouch = "";
  if (previousMode === "favorites") state.filters.favoriteTouch = "";
  render();
}

function openOffspring(horseId) {
  state.mode = "horse";
  state.selectedHorseId = horseId;
  state.offspringHorseId = horseId;
  state.query = "";
  state.filterOpen = false;
  search.value = "";
  render();
}

function openRace(raceKey) {
  state.mode = "race";
  state.offspringHorseId = "";
  state.selectedRaceKey = raceKey;
  state.filterOpen = false;
  state.filters.horseTouch = "";
  state.filters.favoriteTouch = "";
  state.filters.raceG1Only = false;
  state.filters.raceYear = "";
  state.filters.raceName = "";
  const year = raceKey.split(":")[0];
  if (year) state.openRaceYears.add(year);
  render();
}

function render() {
  document.body.dataset.mode = state.mode;
  document.body.dataset.hasQuery = state.query || hasActiveFilters() ? "true" : "false";
  document.body.dataset.filterOpen = state.filterOpen ? "true" : "false";
  document.body.dataset.sidebarOpen = state.sidebarOpen ? "true" : "false";
  document.body.dataset.viewMode = state.viewMode;
  document.body.dataset.commentFont = state.commentFontSize;
  modeHorse.classList.toggle("active", state.mode === "horse");
  modeRace.classList.toggle("active", state.mode === "race");
  modeFavorites.classList.toggle("active", state.mode === "favorites");
  modeFavorites.textContent = `★ (${state.favorites.size})`;
  modeFavorites.title = `お気に入り ${state.favorites.size}枚`;
  modeFavorites.setAttribute("aria-label", `お気に入り ${state.favorites.size}枚`);
  toggleFilter.classList.toggle("active", state.filterOpen || hasActiveFilters());
  toggleFilter.title = state.filterOpen ? "文字選択を閉じる" : "文字選択を開く";
  toggleFilter.setAttribute("aria-label", toggleFilter.title);
  filterControls.hidden = !state.filterOpen;
  toggleComments.classList.toggle("active", state.viewMode !== "two");
  toggleComments.classList.toggle("muted", state.viewMode === "two");
  toggleComments.querySelector("span").textContent = state.viewMode === "two" ? "▥" : state.viewMode === "one" ? "▤" : "≡";
  toggleComments.title = `${viewModeLabel()}表示`;
  toggleComments.setAttribute("aria-label", toggleComments.title);
  toggleSidebar?.classList.toggle("active", state.sidebarOpen);
  if (toggleSidebar) {
    toggleSidebar.title = state.sidebarOpen ? "サイドバーを隠す" : "サイドバーを表示";
    toggleSidebar.setAttribute("aria-label", toggleSidebar.title);
  }
  renderSettingsMenu();
  renderFilterControls();

  if (state.mode === "race") renderRaceList();
  else if (state.mode === "favorites") renderFavoriteList();
  else renderHorseList();

  renderDetail();
}

function renderFilterControls() {
  if (state.mode === "horse") {
    filterControls.innerHTML = `
      ${touchFilterHtml("horse", state.filters.horseTouch, horseTouchCandidates())}
    `;
    return;
  }
  if (state.mode === "race") {
    filterControls.innerHTML = `
      ${raceFilterHtml()}
    `;
    return;
  }
  filterControls.innerHTML = `
    ${touchFilterHtml("favorite", state.filters.favoriteTouch, favoriteTouchCandidates())}
  `;
}

function touchFilterHtml(kind, value, candidates) {
  return `
    <div class="touch-filter">
      <div class="filter-status">
        <span>${escapeHtml(value || "文字を選択")}</span>
        ${value ? `<button type="button" class="filter-clear" data-filter-action="${kind}:back">1字戻す</button>
          <button type="button" class="filter-clear" data-filter-action="${kind}:clear">クリア</button>` : ""}
        <button type="button" class="filter-clear" data-filter-action="filter:close">閉じる</button>
      </div>
      ${kanaPadHtml(kind, candidates)}
    </div>
  `;
}

function kanaPadHtml(kind, candidates) {
  const enabled = new Set(candidates);
  const rows = KANA_PAD_ROWS.map((row) => row.filter((char) => enabled.has(char))).filter((row) => row.length);
  if (!rows.length) return `<div class="empty small">次に選べる文字がありません。</div>`;
  return `
    <div class="kana-pad">
      ${rows.map((row) => `
        <div class="kana-row">
          ${row.map((char) => `<button type="button" class="filter-chip kana-chip" data-filter-action="${kind}:append" data-value="${escapeHtml(char)}">${escapeHtml(char)}</button>`).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function raceFilterHtml() {
  const baseRaces = races().filter((race) => !state.filters.raceG1Only || isG1Race(race.name));
  const yearOptions = [...new Set(baseRaces.map((race) => race.date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const availableRaceNames = new Set(baseRaces
    .filter((race) => !state.filters.raceYear || race.date?.startsWith(state.filters.raceYear))
    .filter((race) => !state.query || race.name.includes(state.query))
    .map((race) => race.name)
  );
  const g1Options = G1_RACES.filter((name) => availableRaceNames.has(name));

  return `
    <div class="race-filter">
      <div class="race-filter-main">
        <select class="filter-select" data-filter-action="race:year" aria-label="年">
          <option value="">すべての年</option>
          ${yearOptions.map((year) => `<option value="${escapeHtml(year)}" ${state.filters.raceYear === year ? "selected" : ""}>${escapeHtml(year)}年</option>`).join("")}
        </select>
        ${filterChip("race:class", "G1", state.filters.raceG1Only ? "G1" : "全レース", false)}
        <button type="button" class="filter-clear race-reset" data-filter-action="race:clear">クリア</button>
      </div>
      <div class="chip-row race-name-chips">
        ${g1Options.map((name) => filterChip("race:name", name, name, state.filters.raceName === name)).join("")}
      </div>
    </div>
  `;
}

function filterChip(action, value, label, active = false, className = "filter-chip") {
  return `<button type="button" class="${className} ${active ? "active" : ""}" data-filter-action="${action}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function renderHorseList() {
  let selectedHorse = horseById(state.selectedHorseId);
  const listFiltered = state.query || hasHorseFilters();
  if (!state.query && !selectedHorse && !hasHorseFilters()) {
    selectedHorse = horseById(firstFavoriteHorseId()) || [...state.db.horses].sort(birthYearSort)[0];
    state.selectedHorseId = selectedHorse?.id || "";
  }
  const result = listFiltered ? horseSearchResult() : horseContextResult(selectedHorse);
  if (!state.selectedHorseId && result.all[0]) state.selectedHorseId = result.all[0].id;

  if (listFiltered) {
    itemList.innerHTML = result.sections.map((section) => `
      <section class="year-group search-group">
        ${sectionHeader(section)}
        ${section.items.map(horseButton).join("")}
      </section>
    `).join("") || `<div class="empty small">該当する馬がありません。</div>`;
  } else {
    itemList.innerHTML = result.sections.map((section) => `
      <section class="year-group search-group">
        ${sectionHeader(section)}
        ${section.items.map(horseButton).join("")}
      </section>
    `).join("") || `<div class="empty small">馬名・父・母で検索してください。</div>`;
  }

  itemList.querySelectorAll("button[data-horse-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedHorseId = button.dataset.horseId;
      state.offspringHorseId = "";
      state.query = "";
      state.filterOpen = false;
      state.filters.horseTouch = "";
      search.value = "";
      closeSidebarAfterListTap();
      render();
    });
  });
  itemList.querySelectorAll("button[data-open-offspring-id]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSidebarAfterListTap();
      openOffspring(button.dataset.openOffspringId);
    });
  });
}

function sectionHeader(section) {
  if (!section.title) return "";
  return `
    <div class="section-title">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.offspringHorseId ? `<button type="button" class="section-action" data-open-offspring-id="${escapeHtml(section.offspringHorseId)}">一覧</button>` : ""}
    </div>
  `;
}

function renderRaceList() {
  const items = filteredRaces();
  if (!items.some((race) => race.key === state.selectedRaceKey)) state.selectedRaceKey = items[0]?.key || "";
  const grouped = Map.groupBy(items, (race) => race.date?.slice(0, 4) || race.key.split(":")[0] || "年不明");
  const latestYear = [...grouped.keys()].sort((a, b) => b.localeCompare(a))[0];
  const selectedYear = state.selectedRaceKey?.split(":")[0] || "";
  if (!state.openRaceYears.size && latestYear) state.openRaceYears.add(latestYear);
  if (selectedYear) state.openRaceYears.add(selectedYear);

  itemList.innerHTML = state.query || hasRaceFilters()
    ? items.map(raceButton).join("")
    : [...grouped.entries()].map(([year, racesInYear]) => `
      <details class="race-year-group" data-race-year="${escapeHtml(year)}" ${state.openRaceYears.has(year) ? "open" : ""}>
        <summary>${escapeHtml(year)}年 <span>${racesInYear.length}レース</span></summary>
        ${racesInYear.map(raceButton).join("")}
      </details>
    `).join("");
  itemList.querySelectorAll("details[data-race-year]").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) state.openRaceYears.add(details.dataset.raceYear);
      else state.openRaceYears.delete(details.dataset.raceYear);
    });
  });
  itemList.querySelectorAll("button[data-race-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRaceKey = button.dataset.raceKey;
      state.filterOpen = false;
      closeSidebarAfterListTap();
      render();
    });
  });
}

function renderFavoriteList() {
  const photos = filteredFavoritePhotos();
  itemList.innerHTML = `
    <section class="year-group">
      ${photos.map((photo) => {
        const horse = horseById(photo.horseId);
        return `
          <button type="button" class="horse-button" data-jump-photo-key="${escapeHtml(photo.key)}">
            <span class="horse-name">
              <span class="inline-link" data-open-horse-id="${escapeHtml(photo.horseId)}">${escapeHtml(horse?.name || "-")}</span>
            </span>
            <span class="horse-meta">${escapeHtml(photo.caption || "")}</span>
          </button>
        `;
      }).join("") || `<div class="empty small">お気に入りはまだありません。</div>`}
    </section>
  `;
  itemList.querySelectorAll("button[data-jump-photo-key]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const horseLink = event.target.closest("[data-open-horse-id]");
      if (horseLink) {
        event.stopPropagation();
        closeSidebarAfterListTap();
        openHorse(horseLink.dataset.openHorseId);
        return;
      }
      renderFavoriteDetail(button.dataset.jumpPhotoKey);
      state.filterOpen = false;
      closeSidebarAfterListTap();
      render();
    });
  });
}

function horseButton(horse) {
  const count = photosForHorse(horse.id).length;
  return `
    <button type="button" class="horse-button ${horse.id === state.selectedHorseId ? "selected" : ""}" data-horse-id="${horse.id}">
      <span class="horse-name">${escapeHtml(horse.name)}</span>
      <span class="horse-meta">${horse.birthYear || "生年不明"} / ${count}枚 / ${escapeHtml(horse.sire || "父不明")}</span>
    </button>
  `;
}

function raceButton(race) {
  return `
    <button type="button" class="horse-button ${race.key === state.selectedRaceKey ? "selected" : ""}" data-race-key="${escapeHtml(race.key)}">
      <span class="horse-name">${escapeHtml(race.name)}</span>
      <span class="horse-meta">${escapeHtml(race.date || "日付未設定")} / ${race.photos.length}枚</span>
    </button>
  `;
}

function renderDetail() {
  if (state.mode === "race") renderRaceDetail();
  else if (state.mode === "favorites") renderFavoriteDetail();
  else if (state.offspringHorseId) renderOffspringDetail();
  else renderHorseDetail();
}

function renderOffspringDetail() {
  const baseHorse = horseById(state.offspringHorseId);
  if (!baseHorse) {
    detail.innerHTML = `<div class="empty">馬を選択してください。</div>`;
    return;
  }
  const offspring = offspringForHorse(baseHorse).sort(birthYearSort);
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <h2>${escapeHtml(baseHorse.name)}産駒一覧</h2>
      </div>
    </div>
    <div class="photos">
      ${offspring.map((horse) => {
        const photo = representativePhotoForHorse(horse.id);
        return photo ? photoCard(photo, { context: "offspring" }) : "";
      }).join("") || `<div class="empty">産駒の写真がありません。</div>`}
    </div>
  `;
}

function renderHorseDetail() {
  const horse = state.db.horses.find((item) => item.id === state.selectedHorseId);
  if (!horse) {
    detail.innerHTML = `<div class="empty">馬を選択してください。</div>`;
    return;
  }

  const photos = photosForHorse(horse.id);
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <div class="horse-title-row">
          <h2>${escapeHtml(horse.name)}</h2>
          ${bodyTagChips(horse)}
        </div>
        <div class="blood">
          <div><span>父</span>${escapeHtml(horse.sire || "-")}</div>
          <div><span>母</span>${escapeHtml(horse.dam || "-")}</div>
          <div><span>母父</span>${escapeHtml(horse.damsire || "-")}</div>
        </div>
      </div>
    </div>
    <div class="photos">
      ${photos.map((photo) => photoCard(photo, { context: "horse" })).join("") || `<div class="empty">写真がありません。</div>`}
    </div>
  `;
}

function renderSettingsMenu() {
  if (!storageMenu || !storageInfo) return;
  storageInfo.innerHTML = `
    <span>${state.db?.horses.length || 0}頭</span>
    <span>${state.db?.photos.length || 0}枚</span>
    <span>${state.db ? races().length : 0}レース</span>
    <span>お気に入り ${state.favorites.size}枚</span>
  `;
  storageMenu.querySelectorAll("button[data-comment-font-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.commentFontSize === state.commentFontSize);
  });
}

function closeSidebarAfterListTap() {
  if (!window.matchMedia("(max-width: 820px)").matches) return;
  state.sidebarOpen = false;
  state.filterOpen = false;
}

function renderRaceDetail() {
  const race = races().find((item) => item.key === state.selectedRaceKey);
  if (!race) {
    detail.innerHTML = `<div class="empty">レースを選択してください。</div>`;
    return;
  }
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <h2>${escapeHtml([race.date, race.name].filter(Boolean).join(" "))}</h2>
      </div>
    </div>
    <div class="photos">
      ${race.photos.map((photo) => photoCard(photo, { context: "race" })).join("")}
    </div>
  `;
}

function renderFavoriteDetail(focusPhotoKey = "") {
  const photos = filteredFavoritePhotos();
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <h2>お気に入り（${photos.length}）</h2>
      </div>
    </div>
    <div class="photos">
      ${photos.map((photo) => photoCard(photo, { context: "favorite", focused: photo.key === focusPhotoKey })).join("") || `<div class="empty">お気に入りはまだありません。</div>`}
    </div>
  `;
  if (focusPhotoKey) detail.querySelector(`[data-photo-card-key="${cssEscape(focusPhotoKey)}"]`)?.scrollIntoView({ block: "center" });
}

function photoCard(photo, options = {}) {
  const { context = "horse", focused = false } = options;
  const src = photo.localImagePath ? `/data/${photo.localImagePath}` : photo.imageUrl;
  const horse = horseById(photo.horseId);
  const raceCaption = [photo.raceDate || photo.photoDate, photo.raceName].filter(Boolean).join(" ");
  const caption = context === "race" || context === "favorite" || context === "offspring"
    ? horse?.name || ""
    : raceCaption || photo.caption || "";
  const meta = context === "favorite" || context === "offspring" ? raceCaption : "";
  const captionButton = context === "race" || context === "favorite" || context === "offspring"
    ? `<button type="button" class="caption-link" data-open-horse-id="${escapeHtml(photo.horseId)}">${escapeHtml(caption || photo.source)}</button>`
    : context === "horse" && photo.raceKey
      ? `<button type="button" class="caption-link" data-open-race-key="${escapeHtml(photo.raceKey)}">${escapeHtml(caption || photo.source)}</button>`
      : `<span>${escapeHtml(caption || photo.source)}</span>`;
  const favorite = state.favorites.has(photo.key);
  const representative = representativePhotoForHorse(photo.horseId)?.key === photo.key;
  const representativeDisabled = favoritePhotosForHorse(photo.horseId).length > 0 && !favorite;
  return `
    <article class="photo-card ${focused ? "focused" : ""}" data-photo-card-key="${escapeHtml(photo.key)}">
      ${src ? `<img src="${src}" alt="${escapeHtml(caption)}" loading="lazy">` : ""}
      <div class="photo-body">
        <div class="caption-row">
          <p class="caption">${captionButton}</p>
          <div class="photo-actions">
            <button type="button" class="representative-button ${representative ? "active" : ""}" data-representative-photo-id="${escapeHtml(photo.key)}" title="代表写真" ${representativeDisabled ? "disabled" : ""}>${representative ? "◆" : "◇"}</button>
            <button type="button" class="favorite-button ${favorite ? "active" : ""}" data-favorite-photo-id="${escapeHtml(photo.key)}" title="お気に入り">${favorite ? "★" : "☆"}</button>
          </div>
        </div>
        ${meta ? `<p class="photo-meta">${escapeHtml(meta)}</p>` : ""}
        ${state.viewMode === "oneComments" && photo.comment ? `<p class="comment">${escapeHtml(photo.comment)}</p>` : ""}
      </div>
    </article>
  `;
}

function horseSearchResult() {
  const query = state.query || state.filters.horseTouch;
  const horses = state.db.horses;
  if (!query) {
    const all = [...horses].sort(birthYearSort);
    return { all, sections: [{ title: "", items: all }] };
  }
  const normalizedQuery = normalizeTouchText(query);
  const matchesText = (value) => normalizeTouchText(value || "").includes(normalizedQuery);
  const equalsText = (value) => normalizeTouchText(value || "") === normalizedQuery;

  const used = new Set();
  const sections = [];
  const addSection = (title, items, options = {}) => {
    const unique = items.filter((horse) => {
      if (used.has(horse.id)) return false;
      used.add(horse.id);
      return true;
    });
    if (unique.length) sections.push({ title, items: unique, ...options });
  };

  addSection("", horses.filter((horse) => equalsText(horse.name)).sort(birthYearSort));
  addSection("産駒", horses.filter((horse) => equalsText(horse.dam) || equalsText(horse.sire)).sort(birthYearSort));
  addSection(`母父 ${query}`, horses.filter((horse) => equalsText(horse.damsire)).sort(birthYearSort));
  addSection("馬名を含む", horses.filter((horse) => matchesText(horse.name)).sort(birthYearSort));
  addSection("血統に含む", horses
    .filter((horse) => [horse.sire, horse.dam, horse.damsire].some(matchesText))
    .sort(birthYearSort));

  return { all: sections.flatMap((section) => section.items), sections };
}

function bodyTagChips(horse) {
  const tags = (horse.bodyTags || []).slice(0, 10);
  if (!tags.length) return "";
  return `
    <div class="body-tags">
      ${tags.map((item) => `
        <span class="body-tag ${item.confidence === "confirmed" ? "confirmed" : "suggested"}" title="${escapeHtml(bodyTagTitle(item))}">
          ${escapeHtml(item.tag)}
        </span>
      `).join("")}
    </div>
  `;
}

function bodyTagTitle(item) {
  const evidence = item.evidence?.[0];
  return [
    item.confidence === "confirmed" ? "明記" : "推定",
    evidence?.raceDate,
    evidence?.raceName,
    evidence?.phrase
  ].filter(Boolean).join(" / ");
}

function horseContextResult(horse) {
  if (!horse) return { all: [], sections: [] };

  const used = new Set();
  const sections = [];
  const addSection = (title, items, options = {}) => {
    const unique = items.filter((item) => {
      if (!item || used.has(item.id)) return false;
      used.add(item.id);
      return true;
    });
    if (unique.length) sections.push({ title, items: unique, ...options });
  };

  addSection("", [horse]);
  addSection("父", state.db.horses.filter((item) => item.name === horse.sire).sort(birthYearSort));
  addSection("産駒", offspringForHorse(horse).sort(birthYearSort), { offspringHorseId: horse.id });
  addSection(`母父 ${horse.name}`, state.db.horses.filter((item) => item.damsire === horse.name).sort(birthYearSort));

  return { all: sections.flatMap((section) => section.items), sections };
}

function filteredRaces() {
  const query = state.query;
  return races().filter((race) => {
    if (query && !race.name.includes(query)) return false;
    if (state.filters.raceG1Only && !isG1Race(race.name)) return false;
    if (state.filters.raceYear && !race.date?.startsWith(state.filters.raceYear)) return false;
    if (state.filters.raceName && race.name !== state.filters.raceName) return false;
    return true;
  });
}

function filteredFavoritePhotos() {
  const query = state.query;
  return state.db.photos
    .filter((photo) => state.favorites.has(photo.key))
    .filter((photo) => {
      const horse = horseById(photo.horseId);
      if (state.filters.favoriteTouch && !normalizeTouchText(horse?.name || "").includes(state.filters.favoriteTouch)) return false;
      if (!query) return true;
      return [horse?.name, photo.raceName, photo.raceDate, photo.caption].some((value) => value?.includes(query));
    })
    .sort(favoritePhotoSort);
}

function filteredHorses() {
  const query = state.filters.horseTouch;
  if (!query) return state.db.horses;
  return state.db.horses.filter((horse) => horseSearchFields(horse).some((value) => normalizeTouchText(value).includes(query)));
}

function races() {
  const grouped = new Map();
  for (const photo of state.db.photos) {
    const key = photo.raceKey || [photo.raceDate || photo.photoDate || "", photo.raceName || ""].join(":");
    if (!key.trim()) continue;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: photo.raceName || "レース名未設定",
        date: photo.raceDate || photo.photoDate || "",
        photos: []
      });
    }
    grouped.get(key).photos.push(photo);
  }
  return [...grouped.values()]
    .map((race) => ({ ...race, photos: race.photos.sort(photoSort) }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name, "ja"));
}

function photosForHorse(horseId) {
  return state.db.photos
    .filter((photo) => photo.horseId === horseId)
    .sort(photoSort);
}

function favoritePhotosForHorse(horseId) {
  return photosForHorse(horseId).filter((photo) => state.favorites.has(photo.key));
}

function firstFavoriteHorseId() {
  return filteredFavoritePhotos()[0]?.horseId || "";
}

function representativePhotoForHorse(horseId) {
  const photos = photosForHorse(horseId);
  const favorites = favoritePhotosForHorse(horseId);
  const savedKey = state.representatives[horseId];
  if (favorites.length) return favorites.find((photo) => photo.key === savedKey) || favorites[0];
  return photos.find((photo) => photo.key === savedKey) || photos[0] || null;
}

function offspringForHorse(horse) {
  return state.db.horses.filter((item) => item.dam === horse.name || item.sire === horse.name);
}

function horseById(horseId) {
  return state.db.horses.find((horse) => horse.id === horseId);
}

function photoSort(a, b) {
  return (b.raceDate || b.photoDate || b.issueDate || "").localeCompare(a.raceDate || a.photoDate || a.issueDate || "") || (a.sourceOrder || 0) - (b.sourceOrder || 0);
}

function hasActiveFilters() {
  if (state.mode === "horse") return hasHorseFilters();
  if (state.mode === "race") return hasRaceFilters();
  return hasFavoriteFilters();
}

function hasHorseFilters() {
  return Boolean(state.filters.horseTouch);
}

function hasRaceFilters() {
  return Boolean(state.filters.raceG1Only || state.filters.raceYear || state.filters.raceName);
}

function hasFavoriteFilters() {
  return Boolean(state.filters.favoriteTouch);
}

function isG1Race(name = "") {
  return G1_RACES.includes(String(name));
}

function horseTouchCandidates() {
  return touchCandidates(state.db.horses.flatMap(horseSearchFields), state.filters.horseTouch, HORSE_TOUCH_LIMIT);
}

function favoriteTouchCandidates() {
  const names = filteredFavoritePhotosWithoutTouch().map((photo) => horseById(photo.horseId)?.name || "");
  return touchCandidates(names, state.filters.favoriteTouch, HORSE_TOUCH_LIMIT);
}

function touchCandidates(values, query) {
  const counts = new Map();
  for (const value of values) {
    const name = normalizeTouchText(value);
    const chars = query ? nextCharsAfterQuery(name, query) : [...new Set([...name])];
    for (const char of chars) {
      if (!isUsefulTouchChar(char)) continue;
      counts.set(char, (counts.get(char) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => kanaOrder(a[0]) - kanaOrder(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([char]) => char);
}

function horseSearchFields(horse) {
  return [horse.name, horse.sire, horse.dam, horse.damsire].filter(Boolean);
}

function kanaOrder(char) {
  for (let rowIndex = 0; rowIndex < KANA_PAD_ROWS.length; rowIndex += 1) {
    const columnIndex = KANA_PAD_ROWS[rowIndex].indexOf(char);
    if (columnIndex >= 0) return rowIndex * 100 + columnIndex;
  }
  return 9999;
}

function nextCharsAfterQuery(value, query) {
  const chars = [];
  let index = value.indexOf(query);
  while (index >= 0) {
    const next = value[index + query.length];
    if (next) chars.push(next);
    index = value.indexOf(query, index + 1);
  }
  return chars;
}

function isUsefulTouchChar(char) {
  return Boolean(char && !/[\s・･()（）［］\[\]【】]/.test(char));
}

function normalizeTouchText(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[ァィゥェォ]/g, (char) => "アイウエオ"["ァィゥェォ".indexOf(char)])
    .replace(/[ャュョッ]/g, (char) => "ヤユヨツ"["ャュョッ".indexOf(char)])
    .replace(/[ヴ]/g, "ウ")
    .replace(/[ガギグゲゴ]/g, (char) => "カキクケコ"["ガギグゲゴ".indexOf(char)])
    .replace(/[ザジズゼゾ]/g, (char) => "サシスセソ"["ザジズゼゾ".indexOf(char)])
    .replace(/[ダヂヅデド]/g, (char) => "タチツテト"["ダヂヅデド".indexOf(char)])
    .replace(/[バビブベボ]/g, (char) => "ハヒフヘホ"["バビブベボ".indexOf(char)])
    .replace(/[パピプペポ]/g, (char) => "ハヒフヘホ"["パピプペポ".indexOf(char)])
    .toUpperCase();
}

function filteredFavoritePhotosWithoutTouch() {
  const saved = state.filters.favoriteTouch;
  state.filters.favoriteTouch = "";
  const photos = filteredFavoritePhotos();
  state.filters.favoriteTouch = saved;
  return photos;
}

function favoritePhotoSort(a, b) {
  const horseA = horseById(a.horseId);
  const horseB = horseById(b.horseId);
  const birthDiff = (horseB?.birthYear || 0) - (horseA?.birthYear || 0);
  if (birthDiff !== 0) return birthDiff;
  const nameDiff = (horseA?.name || "").localeCompare(horseB?.name || "", "ja");
  if (nameDiff !== 0) return nameDiff;
  return (b.raceDate || b.photoDate || b.issueDate || "").localeCompare(a.raceDate || a.photoDate || a.issueDate || "") || (a.sourceOrder || 0) - (b.sourceOrder || 0);
}

function birthYearSort(a, b) {
  return (b.birthYear || 0) - (a.birthYear || 0) || a.name.localeCompare(b.name, "ja");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function cssEscape(value = "") {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

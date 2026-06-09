const FAVORITES_KEY = "photo-paddock:favorites:v3";
const REPRESENTATIVES_KEY = "photo-paddock:representatives:v1";
const HALL_OF_FAME_KEY = "photo-paddock:hall-of-fame:v1";
const PHOTO_ADJUSTMENTS_KEY = "photo-paddock:photo-adjustments:v1";
const VIEW_MODE_KEY = "photo-paddock:view-mode";
const COMMENT_FONT_KEY = "photo-paddock:comment-font-size";
const STORAGE_EXPORT_VERSION = 2;
const VIEW_MODES = ["two", "one", "oneComments"];
const COMMENT_FONT_SIZES = ["normal", "large"];

const state = {
  db: null,
  raceResults: { version: 1, races: {} },
  mode: "favorites",
  selectedHorseId: "",
  selectedRaceKey: "",
  raceHistoryMode: "",
  offspringHorseId: "",
  offspringHorseName: "",
  query: "",
  viewMode: loadViewMode(),
  commentFontSize: loadCommentFontSize(),
  sidebarOpen: false,
  filterOpen: false,
  storageOpen: false,
  openRaceYears: new Set(),
  favorites: new Set(loadFavoriteIds()),
  representatives: loadRepresentatives(),
  hallOfFame: new Set(loadHallOfFameIds()),
  photoAdjustments: loadPhotoAdjustments(),
  activePhotoAdjustment: "",
  filters: {
    horseTouch: "",
    raceGrade: "",
    raceYear: "",
    raceName: "",
    favoriteTouch: "",
    favoriteSire: "",
    favoriteBirthYear: "",
    favoriteHallOnly: false,
    recentFavoriteSire: "",
    recentFavoriteBirthYear: "",
    offspringFavoritesOnly: false
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

const GRADE_RACES = {
  G1: [
    ...G1_RACES,
    "ジャパンカップダート",
    "マイルCS南部杯",
    "JBCクラシック",
    "JBCスプリント",
    "JBCレディスクラシック"
  ],
  G2: [
    "日経新春杯", "アメリカJCC", "東海S", "京都記念", "中山記念", "チューリップ賞", "弥生賞",
    "フィリーズレビュー", "金鯱賞", "スプリングS", "阪神大賞典", "日経賞", "ニュージーランドT",
    "阪神牝馬S", "フローラS", "マイラーズC", "青葉賞", "京都新聞杯", "京王杯SC", "目黒記念",
    "札幌記念", "セントウルS", "ローズS", "セントライト記念", "神戸新聞杯", "オールカマー",
    "毎日王冠", "京都大賞典", "府中牝馬S", "富士S", "スワンS", "京王杯2歳S", "デイリー杯2歳S",
    "東京スポーツ杯2歳S", "アルゼンチン共和国杯", "ステイヤーズS", "阪神カップ"
  ],
  G3: [
    "中山金杯", "京都金杯", "フェアリーS", "シンザン記念", "京成杯", "根岸S", "シルクロードS",
    "東京新聞杯", "きさらぎ賞", "クイーンC", "共同通信杯", "ダイヤモンドS", "小倉大賞典",
    "アーリントンC", "阪急杯", "オーシャンS", "中山牝馬S", "ファルコンS", "フラワーC",
    "毎日杯", "マーチS", "ダービー卿CT", "アンタレスS", "福島牝馬S", "新潟大賞典", "平安S",
    "鳴尾記念", "エプソムC", "函館スプリントS", "マーメイドS", "ユニコーンS", "ラジオNIKKEI賞",
    "函館記念", "中京記念", "アイビスサマーダッシュ", "クイーンS", "レパードS", "エルムS",
    "関屋記念", "小倉記念", "北九州記念", "CBC賞", "新潟2歳S", "キーンランドカップ",
    "札幌2歳S", "小倉2歳S", "新潟記念", "紫苑S", "京成杯AH", "シリウスS",
    "サウジアラビアRC", "アルテミスS", "ファンタジーS", "みやこS", "武蔵野S", "福島記念",
    "京都2歳S", "京阪杯", "チャレンジC", "中日新聞杯", "カペラS", "ターコイズS"
  ]
};

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
const storageMenuHome = document.querySelector(".sidebar-controls");
const exportStorage = document.querySelector("#exportStorage");
const importStorage = document.querySelector("#importStorage");
const toast = document.querySelector("#toast");
let racesCache = null;

const appUrl = new URL(import.meta.url);
const dataUrl = appUrl.pathname.includes("/public/")
  ? new URL("../data/photo-paddock.json", appUrl)
  : new URL("./data/photo-paddock.json", appUrl);
const raceResultsUrl = appUrl.pathname.includes("/public/")
  ? new URL("../data/race-results.json", appUrl)
  : new URL("./data/race-results.json", appUrl);
const response = await fetch(dataUrl);
state.db = await response.json();
state.raceResults = await loadRaceResults();
normalizePhotoStatusState();
registerServiceWorker();

summary.textContent = `${state.db.horses.length}頭 / ${state.db.photos.length}枚 / ${races().length}レース / 取得ページ ${state.db.pages.length}件`;
search.placeholder = "お気に入りを入力検索";
render();

search.addEventListener("input", () => {
  state.query = search.value.trim();
  if (state.query) state.sidebarOpen = true;
  if (state.mode === "horse") clearOffspringSelection();
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
  state.storageOpen = Boolean(open);
  if (state.storageOpen) {
    state.filterOpen = false;
  }
  render();
});
exportStorage?.addEventListener("click", exportStorageData);
importStorage?.addEventListener("change", importStorageData);
storageMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-comment-font-size]");
  if (!button) return;
  setCommentFontSize(button.dataset.commentFontSize);
});

detail.addEventListener("click", (event) => {
  const raceHistoryButton = event.target.closest("button[data-race-history-mode]");
  if (raceHistoryButton) {
    state.raceHistoryMode = state.raceHistoryMode === raceHistoryButton.dataset.raceHistoryMode ? "" : raceHistoryButton.dataset.raceHistoryMode;
    render();
    return;
  }

  const offspringFavoriteButton = event.target.closest("button[data-toggle-offspring-favorites]");
  if (offspringFavoriteButton) {
    state.filters.offspringFavoritesOnly = !state.filters.offspringFavoritesOnly;
    render();
    return;
  }

  const photoAdjustButton = event.target.closest("button[data-photo-adjust-id]");
  if (photoAdjustButton) {
    handlePhotoAdjustment(photoAdjustButton.dataset.photoAdjustId, photoAdjustButton.dataset.photoAdjustAction);
    return;
  }

  const statusButton = event.target.closest("button[data-photo-status-id]");
  if (statusButton) {
    togglePhotoStatus(statusButton.dataset.photoStatusId);
    return;
  }

  const hallButton = event.target.closest("button[data-toggle-hall-id]");
  if (hallButton) {
    toggleHallOfFame(hallButton.dataset.toggleHallId);
    return;
  }

  const favoriteHallButton = event.target.closest("button[data-toggle-favorite-hall]");
  if (favoriteHallButton) {
    state.filters.favoriteHallOnly = !state.filters.favoriteHallOnly;
    render();
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
    openOffspring(offspringLink.dataset.openOffspringId, offspringLink.dataset.openOffspringMode);
    return;
  }

  const offspringNameLink = event.target.closest("button[data-open-offspring-name]");
  if (offspringNameLink) {
    openOffspringByName(offspringNameLink.dataset.openOffspringName, offspringNameLink.dataset.openOffspringMode);
    return;
  }

  const pedigreeSearchLink = event.target.closest("button[data-search-pedigree]");
  if (pedigreeSearchLink) {
    searchHorseByPedigreeName(pedigreeSearchLink.dataset.searchPedigree);
  }
});

detail.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-favorite-filter]");
  if (!select) return;
  setFavoriteDetailFilter(select.dataset.favoriteFilter, select.value);
  render();
});

toast.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-undo-favorite]");
  if (!button || !state.undoFavorite) return;
  const photo = state.db.photos.find((item) => item.key === state.undoFavorite.photoKey);
  if (photo) {
    clearFavoritesForHorse(photo.horseId);
    state.favorites.add(photo.key);
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
    hallOfFame: [...state.hallOfFame],
    photoAdjustments: state.photoAdjustments,
    viewMode: state.viewMode,
    commentFontSize: state.commentFontSize
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  link.href = url;
  link.download = `photo-paddock-${state.favorites.size}-${date}.json`;
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
    if (Array.isArray(data.hallOfFame)) {
      for (const horseId of data.hallOfFame) {
        if (typeof horseId === "string") state.hallOfFame.add(horseId);
      }
    }
    if (data.photoAdjustments && typeof data.photoAdjustments === "object" && !Array.isArray(data.photoAdjustments)) {
      state.photoAdjustments = { ...state.photoAdjustments, ...data.photoAdjustments };
    }
    if (VIEW_MODES.includes(data.viewMode)) {
      state.viewMode = data.viewMode;
      localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
    } else if (typeof data.showComments === "boolean") {
      state.viewMode = data.showComments ? "oneComments" : "two";
      localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
    }
    if (COMMENT_FONT_SIZES.includes(data.commentFontSize)) setCommentFontSize(data.commentFontSize, false);
    normalizePhotoStatusState();
    saveFavorites();
    saveRepresentatives();
    saveHallOfFame();
    savePhotoAdjustments();
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
  state.storageOpen = false;
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

function loadHallOfFameIds() {
  try {
    const value = JSON.parse(localStorage.getItem(HALL_OF_FAME_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveHallOfFame() {
  localStorage.setItem(HALL_OF_FAME_KEY, JSON.stringify([...state.hallOfFame]));
}

function loadPhotoAdjustments() {
  try {
    const value = JSON.parse(localStorage.getItem(PHOTO_ADJUSTMENTS_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function savePhotoAdjustments() {
  localStorage.setItem(PHOTO_ADJUSTMENTS_KEY, JSON.stringify(state.photoAdjustments));
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

async function loadRaceResults() {
  try {
    const response = await fetch(raceResultsUrl);
    if (!response.ok) return { version: 1, races: {} };
    const data = await response.json();
    return {
      version: 1,
      races: {},
      ...data
    };
  } catch {
    return { version: 1, races: {} };
  }
}

function togglePhotoStatus(photoKey) {
  const photo = state.db.photos.find((item) => item.key === photoKey);
  if (!photo) return;
  const status = photoStatus(photo);
  clearFavoritesForHorse(photo.horseId);
  state.representatives[photo.horseId] = photo.key;
  if (status === "representative") state.favorites.add(photo.key);
  saveRepresentatives();
  saveFavorites();
  clearUndoFavorite();
  render();
}

function toggleHallOfFame(horseId) {
  if (!horseById(horseId)) return;
  if (state.hallOfFame.has(horseId)) state.hallOfFame.delete(horseId);
  else state.hallOfFame.add(horseId);
  saveHallOfFame();
  render();
}

function clearFavoritesForHorse(horseId) {
  photosForHorse(horseId).forEach((photo) => state.favorites.delete(photo.key));
}

function photoStatus(photo) {
  if (state.favorites.has(photo.key)) return "favorite";
  if (representativePhotoForHorse(photo.horseId)?.key === photo.key) return "representative";
  return "none";
}

function photoStatusIcon(status) {
  if (status === "favorite") return "★";
  if (status === "representative") return "◆";
  return "◇";
}

function photoStatusLabel(status) {
  if (status === "favorite") return "お気に入り";
  if (status === "representative") return "代表写真";
  return "未選択";
}

function handlePhotoAdjustment(photoKey, action) {
  if (!photoKey) return;
  if (!action || action === "toggle") {
    state.activePhotoAdjustment = state.activePhotoAdjustment === photoKey ? "" : photoKey;
    render();
    return;
  }
  const current = photoAdjustment(photoKey);
  if (action === "reset") {
    delete state.photoAdjustments[photoKey];
  } else {
    const next = { ...current };
    if (action === "zoomIn") next.scale = clamp(Number((next.scale + 0.05).toFixed(2)), 1, 1.5);
    if (action === "zoomOut") next.scale = clamp(Number((next.scale - 0.05).toFixed(2)), 1, 1.5);
    if (action === "left") next.x = clamp(next.x - 5, 0, 100);
    if (action === "right") next.x = clamp(next.x + 5, 0, 100);
    if (action === "up") next.y = clamp(next.y - 5, 0, 100);
    if (action === "down") next.y = clamp(next.y + 5, 0, 100);
    if (next.scale === 1 && next.x === 50 && next.y === 50) delete state.photoAdjustments[photoKey];
    else state.photoAdjustments[photoKey] = next;
  }
  state.activePhotoAdjustment = photoKey;
  savePhotoAdjustments();
  render();
}

function photoAdjustment(photoKey) {
  const saved = state.photoAdjustments[photoKey] || {};
  return {
    scale: clamp(Number(saved.scale) || 1, 1, 1.5),
    x: clamp(Number(saved.x) || 50, 0, 100),
    y: clamp(Number(saved.y) || 50, 0, 100)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePhotoStatusState() {
  if (!state.db) return;
  let changed = false;
  let hallChanged = false;
  const validHorseIds = new Set(state.db.horses.map((horse) => horse.id));
  for (const horseId of [...state.hallOfFame]) {
    if (!validHorseIds.has(horseId)) {
      state.hallOfFame.delete(horseId);
      hallChanged = true;
    }
  }
  for (const horse of state.db.horses) {
    const photos = photosForHorse(horse.id);
    if (!photos.length) continue;
    const favoritePhotos = photos.filter((photo) => state.favorites.has(photo.key));
    if (favoritePhotos.length) {
      const keep = favoritePhotos.find((photo) => photo.key === state.representatives[horse.id]) || favoritePhotos[0];
      for (const photo of favoritePhotos) {
        if (photo.key !== keep.key) {
          state.favorites.delete(photo.key);
          changed = true;
        }
      }
      if (state.representatives[horse.id] !== keep.key) {
        state.representatives[horse.id] = keep.key;
        changed = true;
      }
      continue;
    }
    if (state.representatives[horse.id] && !photos.some((photo) => photo.key === state.representatives[horse.id])) {
      delete state.representatives[horse.id];
      changed = true;
    }
  }
  if (changed) {
    saveFavorites();
    saveRepresentatives();
  }
  if (hallChanged) saveHallOfFame();
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
  if (mode !== "horse") clearOffspringSelection();
  if (mode !== "favorites") resetFavoriteDetailFilters();
  if (changed) {
    state.filterOpen = false;
    state.sidebarOpen = Boolean(state.query);
    if (mode === "horse" && !state.selectedHorseId) {
      state.selectedHorseId = firstFavoriteHorseId() || "";
    }
  }
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
    clearOffspringSelection();
    state.sidebarOpen = true;
    return;
  }
  if (action === "horse:back") {
    state.filters.horseTouch = state.filters.horseTouch.slice(0, -1);
    state.selectedHorseId = "";
    clearOffspringSelection();
    state.sidebarOpen = true;
    return;
  }
  if (action === "horse:clear") {
    state.filters.horseTouch = "";
    state.selectedHorseId = "";
    clearOffspringSelection();
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
    state.filters.raceGrade = value && state.filters.raceGrade !== value ? value : "";
    state.filters.raceName = "";
    state.selectedRaceKey = "";
    state.raceHistoryMode = "";
    return;
  }
  if (action === "race:clear") {
    state.query = "";
    search.value = "";
    state.filters.raceGrade = "";
    state.filters.raceYear = "";
    state.filters.raceName = "";
    state.selectedRaceKey = "";
    state.raceHistoryMode = "";
    return;
  }
  if (action === "race:year") {
    state.filters.raceYear = value;
    state.selectedRaceKey = "";
    state.raceHistoryMode = "";
    return;
  }
  if (action === "race:name") {
    state.filters.raceName = state.filters.raceName === value ? "" : value;
    state.selectedRaceKey = "";
    state.raceHistoryMode = "";
  }
}

function openHorse(horseId) {
  const previousMode = state.mode;
  state.mode = "horse";
  resetFavoriteDetailFilters();
  state.selectedHorseId = horseId;
  clearOffspringSelection();
  clearQuery();
  state.filterOpen = false;
  state.filters.horseTouch = "";
  if (previousMode === "favorites") state.filters.favoriteTouch = "";
  render();
}

function openOffspring(horseId, mode = "") {
  state.mode = "horse";
  resetFavoriteDetailFilters();
  state.selectedHorseId = horseId;
  state.offspringHorseId = horseId;
  state.offspringHorseName = "";
  setOffspringListMode(mode);
  state.query = "";
  state.filterOpen = false;
  search.value = "";
  render();
}

function openOffspringByName(name, mode = "") {
  state.mode = "horse";
  resetFavoriteDetailFilters();
  state.offspringHorseId = "";
  state.offspringHorseName = name;
  setOffspringListMode(mode);
  state.query = "";
  state.filterOpen = false;
  state.filters.horseTouch = "";
  search.value = "";
  render();
}

function setOffspringListMode(mode) {
  if (mode === "favorites") state.filters.offspringFavoritesOnly = true;
  if (mode === "all") state.filters.offspringFavoritesOnly = false;
}

function openRace(raceKey) {
  state.mode = "race";
  resetFavoriteDetailFilters();
  clearOffspringSelection();
  state.selectedRaceKey = raceKey;
  state.raceHistoryMode = "";
  clearQuery();
  state.filterOpen = false;
  state.filters.horseTouch = "";
  state.filters.favoriteTouch = "";
  state.filters.raceGrade = "";
  state.filters.raceYear = "";
  state.filters.raceName = "";
  const year = raceKey.split(":")[0];
  if (year) setOpenRaceYear(year);
  render();
}

function clearQuery() {
  state.query = "";
  search.value = "";
}

function setFavoriteDetailFilter(kind, value) {
  if (kind === "sire") {
    state.filters.favoriteSire = value;
    if (value) state.filters.recentFavoriteSire = value;
  }
  if (kind === "birthYear") {
    state.filters.favoriteBirthYear = value;
    if (value) state.filters.recentFavoriteBirthYear = value;
  }
}

function resetFavoriteDetailFilters() {
  if (state.filters.favoriteSire) state.filters.recentFavoriteSire = state.filters.favoriteSire;
  if (state.filters.favoriteBirthYear) state.filters.recentFavoriteBirthYear = state.filters.favoriteBirthYear;
  state.filters.favoriteSire = "";
  state.filters.favoriteBirthYear = "";
  state.filters.favoriteHallOnly = false;
}

function searchHorseByPedigreeName(name) {
  if (!name) return;
  state.mode = "horse";
  resetFavoriteDetailFilters();
  clearOffspringSelection();
  state.query = name;
  state.filters.horseTouch = "";
  state.filterOpen = false;
  state.sidebarOpen = true;
  search.value = name;
  const exact = state.db.horses.find((horse) => normalizeTouchText(horse.name) === normalizeTouchText(name));
  if (exact) state.selectedHorseId = exact.id;
  render();
}

function clearOffspringSelection() {
  state.offspringHorseId = "";
  state.offspringHorseName = "";
}

function render() {
  syncSearchControl();
  document.body.dataset.mode = state.mode;
  document.body.dataset.hasQuery = state.query || hasActiveFilters() ? "true" : "false";
  document.body.dataset.filterOpen = state.filterOpen ? "true" : "false";
  document.body.dataset.sidebarOpen = state.sidebarOpen ? "true" : "false";
  document.body.dataset.storageOpen = state.storageOpen ? "true" : "false";
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
  syncStorageMenuHost();
  if (storageMenu) storageMenu.hidden = !state.storageOpen;
  toggleStorage?.classList.toggle("active", state.storageOpen);
  renderFilterControls();

  if (state.query) renderGlobalSearchList();
  else if (state.mode === "race") renderRaceList();
  else if (state.mode === "favorites") renderFavoriteList();
  else renderHorseList();

  renderDetail();
}

function syncSearchControl() {
  search.placeholder = "検索";
  search.removeAttribute("list");
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
  const baseRaces = races().filter((race) => !state.filters.raceGrade || raceGrade(race) === state.filters.raceGrade);
  const yearOptions = [...new Set(baseRaces.map((race) => race.date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const availableRaceNames = new Set(baseRaces
    .filter((race) => !state.filters.raceYear || race.date?.startsWith(state.filters.raceYear))
    .filter((race) => !state.query || race.name.includes(state.query))
    .map((race) => race.name)
  );
  const raceNameOptions = raceNameFilterOptions(baseRaces, availableRaceNames);

  return `
    <div class="race-filter">
      <div class="race-filter-main">
        <select class="filter-select" data-filter-action="race:year" aria-label="年">
          <option value="">すべての年</option>
          ${yearOptions.map((year) => `<option value="${escapeHtml(year)}" ${state.filters.raceYear === year ? "selected" : ""}>${escapeHtml(year)}年</option>`).join("")}
        </select>
        ${filterChip("race:class", "", "全レース", !state.filters.raceGrade)}
        ${["G1", "G2", "G3"].map((grade) => filterChip("race:class", grade, grade, state.filters.raceGrade === grade)).join("")}
        <button type="button" class="filter-clear race-reset" data-filter-action="race:clear">クリア</button>
      </div>
      <div class="chip-row race-name-chips">
        ${raceNameOptions.map((name) => filterChip("race:name", name, name, state.filters.raceName === name)).join("")}
      </div>
    </div>
  `;
}

function filterChip(action, value, label, active = false, className = "filter-chip") {
  return `<button type="button" class="${className} ${active ? "active" : ""}" data-filter-action="${action}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function renderGlobalSearchList() {
  const sections = globalSearchSections(state.query);
  itemList.innerHTML = sections.map((section) => `
    <section class="year-group search-group">
      ${sectionHeader(section)}
      ${section.items.map((item) => {
        if (section.type === "race") return raceButton(item);
        if (section.type === "favorite") return favoritePhotoButton(item);
        return horseButton(item);
      }).join("")}
    </section>
  `).join("") || `<div class="empty small">該当する候補がありません。</div>`;

  itemList.querySelectorAll("button[data-horse-id]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSidebarAfterListTap();
      openHorse(button.dataset.horseId);
    });
  });
  itemList.querySelectorAll("button[data-race-key]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSidebarAfterListTap();
      openRace(button.dataset.raceKey);
    });
  });
  itemList.querySelectorAll("button[data-open-offspring-id]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSidebarAfterListTap();
      openOffspring(button.dataset.openOffspringId, button.dataset.openOffspringMode);
    });
  });
  itemList.querySelectorAll("button[data-open-offspring-name]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSidebarAfterListTap();
      openOffspringByName(button.dataset.openOffspringName, button.dataset.openOffspringMode);
    });
  });
  itemList.querySelectorAll("button[data-jump-photo-key]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const horseLink = event.target.closest("[data-open-horse-id]");
      if (horseLink) {
        event.stopPropagation();
        closeSidebarAfterListTap();
        openHorse(horseLink.dataset.openHorseId);
        return;
      }
      state.mode = "favorites";
      clearQuery();
      state.filterOpen = false;
      closeSidebarAfterListTap();
      render();
      renderFavoriteDetail(button.dataset.jumpPhotoKey);
    });
  });
}

function renderHorseList() {
  let selectedHorse = horseById(state.selectedHorseId);
  const listFiltered = state.query || hasHorseFilters();
  let result = null;
  if (!listFiltered && state.offspringHorseName) {
    result = horseNameContextResult(state.offspringHorseName);
  }
  if (!result && !state.query && !selectedHorse && !hasHorseFilters()) {
    selectedHorse = horseById(firstFavoriteHorseId()) || [...state.db.horses].sort(birthYearSort)[0];
    state.selectedHorseId = selectedHorse?.id || "";
  }
  result ||= listFiltered ? horseSearchResult() : horseContextResult(selectedHorse);
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
      clearOffspringSelection();
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
      openOffspring(button.dataset.openOffspringId, button.dataset.openOffspringMode);
    });
  });
  itemList.querySelectorAll("button[data-open-offspring-name]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSidebarAfterListTap();
      openOffspringByName(button.dataset.openOffspringName, button.dataset.openOffspringMode);
    });
  });
}

function sectionHeader(section) {
  if (!section.title) return "";
  const offspringAction = section.offspringHorseId
    ? `
      <div class="section-actions">
        <button type="button" class="section-action" data-open-offspring-id="${escapeHtml(section.offspringHorseId)}" data-open-offspring-mode="favorites">★一覧</button>
        <button type="button" class="section-action" data-open-offspring-id="${escapeHtml(section.offspringHorseId)}" data-open-offspring-mode="all">全一覧</button>
      </div>
    `
    : section.offspringHorseName
      ? `
        <div class="section-actions">
          <button type="button" class="section-action" data-open-offspring-name="${escapeHtml(section.offspringHorseName)}" data-open-offspring-mode="favorites">★一覧</button>
          <button type="button" class="section-action" data-open-offspring-name="${escapeHtml(section.offspringHorseName)}" data-open-offspring-mode="all">全一覧</button>
        </div>
      `
      : "";
  return `
    <div class="section-title">
      <h2>${escapeHtml(section.title)}</h2>
      ${offspringAction}
    </div>
  `;
}

function renderRaceList() {
  const items = filteredRaces();
  if (!items.some((race) => race.key === state.selectedRaceKey)) {
    state.selectedRaceKey = items[0]?.key || "";
    state.raceHistoryMode = "";
  }
  const grouped = Map.groupBy(items, (race) => race.date?.slice(0, 4) || race.key.split(":")[0] || "年不明");
  const years = [...grouped.keys()].sort((a, b) => b.localeCompare(a));
  const latestYear = years[0];
  const oldestYear = years.at(-1);
  if (!state.openRaceYears.size && latestYear) setOpenRaceYear(latestYear);

  itemList.innerHTML = state.query || hasRaceFilters()
    ? items.map(raceButton).join("")
    : [...grouped.entries()].map(([year, racesInYear]) => `
      <details class="race-year-group" data-race-year="${escapeHtml(year)}" ${state.openRaceYears.has(year) ? "open" : ""}>
        <summary>${escapeHtml(year)}年 <span>${racesInYear.length}レース</span></summary>
        ${racesInYear.map(raceButton).join("")}
      </details>
    `).join("");
  itemList.querySelectorAll("details[data-race-year] summary").forEach((summary) => {
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const year = summary.closest("details")?.dataset.raceYear || "";
      setOpenRaceYear(state.openRaceYears.has(year) ? oldestYear : year);
      render();
    });
  });
  itemList.querySelectorAll("button[data-race-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRaceKey = button.dataset.raceKey;
      state.raceHistoryMode = "";
      state.filterOpen = false;
      closeSidebarAfterListTap();
      render();
    });
  });
}

function setOpenRaceYear(year) {
  state.openRaceYears = new Set(year ? [year] : []);
}

function renderFavoriteList() {
  const photos = filteredFavoritePhotos();
  itemList.innerHTML = `
    <section class="year-group">
      ${photos.map(favoritePhotoButton).join("") || `<div class="empty small">${state.filters.favoriteHallOnly ? "殿堂入りはまだありません。" : "お気に入りはまだありません。"}</div>`}
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

function favoritePhotoButton(photo) {
  const horse = horseById(photo.horseId);
  const hallMark = hasHallOfFameHorse(photo.horseId) ? `<span class="hall-mark" aria-label="殿堂入り">♛</span>` : "";
  return `
    <button type="button" class="horse-button" data-jump-photo-key="${escapeHtml(photo.key)}">
      <span class="horse-name">
        <span class="inline-link" data-open-horse-id="${escapeHtml(photo.horseId)}">${escapeHtml(horse?.name || "-")}</span>${hallMark}
      </span>
      <span class="horse-meta">${escapeHtml(photo.caption || "")}</span>
    </button>
  `;
}

function horseButton(horse) {
  const count = photosForHorse(horse.id).length;
  const favoriteMark = hasFavoriteHorse(horse.id) ? `<span class="favorite-mark" aria-label="お気に入りあり">★</span>` : "";
  const hallMark = hasHallOfFameHorse(horse.id) ? `<span class="hall-mark" aria-label="殿堂入り">♛</span>` : "";
  return `
    <button type="button" class="horse-button ${horse.id === state.selectedHorseId ? "selected" : ""}" data-horse-id="${horse.id}">
      <span class="horse-name">${escapeHtml(horse.name)}${hallMark}${favoriteMark}</span>
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
  else if (state.offspringHorseId || state.offspringHorseName) renderOffspringDetail();
  else renderHorseDetail();
}

function renderOffspringDetail() {
  const baseHorse = horseById(state.offspringHorseId);
  const baseName = baseHorse?.name || state.offspringHorseName;
  if (!baseName) {
    detail.innerHTML = `<div class="empty">馬を選択してください。</div>`;
    return;
  }
  const allOffspring = offspringForName(baseName).sort(favoriteBirthYearSort);
  const offspring = state.filters.offspringFavoritesOnly ? allOffspring.filter((horse) => hasFavoriteHorse(horse.id)) : allOffspring;
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <div class="detail-title-row">
          <h2>${escapeHtml(baseName)}産駒（${offspring.length}）</h2>
          <button type="button" class="icon-button offspring-favorite-toggle ${state.filters.offspringFavoritesOnly ? "active" : ""}" data-toggle-offspring-favorites title="${state.filters.offspringFavoritesOnly ? "お気に入りのみ" : "全馬"}" aria-label="${state.filters.offspringFavoritesOnly ? "お気に入りのみ" : "全馬"}">
            <span aria-hidden="true">${state.filters.offspringFavoritesOnly ? "★" : "☆"}</span>
          </button>
        </div>
      </div>
    </div>
    <div class="photos">
      ${offspring.map((horse) => {
        const photo = representativePhotoForHorse(horse.id);
        return photo ? photoCard(photo, { context: "offspring", baseName }) : "";
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
  const hall = hasHallOfFameHorse(horse.id);
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <div class="horse-title-row">
          <h2>${escapeHtml(horse.name)}${hall ? `<span class="hall-mark" aria-label="殿堂入り">♛</span>` : ""}</h2>
          <button type="button" class="hall-status-button detail-hall-toggle ${hall ? "active" : ""}" data-toggle-hall-id="${escapeHtml(horse.id)}" title="${hall ? "殿堂入りを解除" : "殿堂入りにする"}" aria-label="${hall ? "殿堂入りを解除" : "殿堂入りにする"}">♛</button>
          ${bodyTagChips(horse)}
        </div>
        <div class="blood">
          ${bloodLine("父", horse.sire)}
          ${bloodLine("母", horse.dam)}
          ${bloodLine("母父", horse.damsire)}
        </div>
      </div>
    </div>
    <div class="photos">
      ${photos.map((photo) => photoCard(photo, { context: "horse" })).join("") || `<div class="empty">写真がありません。</div>`}
    </div>
  `;
}

function bloodLine(label, name) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>${name
        ? `<button type="button" class="blood-link" data-search-pedigree="${escapeHtml(name)}">${escapeHtml(name)}</button>`
        : "-"}
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
    <span>殿堂入り ${state.hallOfFame.size}頭</span>
  `;
  storageMenu.querySelectorAll("button[data-comment-font-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.commentFontSize === state.commentFontSize);
  });
}

function syncStorageMenuHost() {
  if (!storageMenu || !storageMenuHome) return;
  const shouldFloat = window.matchMedia("(max-width: 820px)").matches;
  if (shouldFloat && storageMenu.parentElement !== document.body) {
    document.body.append(storageMenu);
    return;
  }
  if (!shouldFloat && storageMenu.parentElement === document.body) {
    storageMenuHome.insertBefore(storageMenu, filterControls);
  }
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
  const historyPhotos = state.raceHistoryMode ? historicalRacePhotos(race, state.raceHistoryMode) : [];
  const photos = state.raceHistoryMode ? historyPhotos : race.photos;
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <div class="detail-title-row race-title-row">
          <h2>${escapeHtml([race.date, race.name].filter(Boolean).join(" "))}</h2>
          <div class="detail-actions">
            <button type="button" class="filter-chip ${state.raceHistoryMode === "winners" ? "active" : ""}" data-race-history-mode="winners">優勝馬</button>
            <button type="button" class="filter-chip ${state.raceHistoryMode === "top3" ? "active" : ""}" data-race-history-mode="top3">好走馬</button>
          </div>
        </div>
      </div>
    </div>
    <div class="photos">
      ${photos.map((photo) => photoCard(photo, { context: state.raceHistoryMode ? "raceHistory" : "race" })).join("") || `<div class="empty">${state.raceHistoryMode ? "該当する過去カードがありません。" : "写真がありません。"}</div>`}
    </div>
  `;
}

function historicalRacePhotos(race, mode) {
  const family = raceFamilyName(race.name);
  return races()
    .filter((item) => item.key !== race.key && raceFamilyName(item.name) === family)
    .flatMap((item) => item.photos.map((photo) => ({ photo, result: raceResultForPhoto(photo) })))
    .filter(({ result }) => {
      const finish = Number(result?.finish);
      if (!Number.isFinite(finish)) return false;
      return mode === "winners" ? finish === 1 : finish >= 1 && finish <= 3;
    })
    .sort((a, b) => {
      const dateCompare = (b.photo.raceDate || b.photo.photoDate || "").localeCompare(a.photo.raceDate || a.photo.photoDate || "");
      if (dateCompare) return dateCompare;
      return Number(a.result?.finish || 99) - Number(b.result?.finish || 99);
    })
    .map(({ photo }) => photo);
}

function raceFamilyName(name) {
  const normalized = normalizeResultRaceName(name);
  const aliases = {
    "ジャパンカップダート": "チャンピオンズカップ"
  };
  return aliases[normalized] || normalized;
}

function favoriteDetailFiltersHtml() {
  const photos = favoritePhotos();
  if (!photos.length) return "";
  const hallPhotoCount = photos.filter((photo) => hasHallOfFameHorse(photo.horseId)).length;
  const horses = uniqueHorses(photos.map((photo) => horseById(photo.horseId)).filter(Boolean));
  const yearScopedHorses = state.filters.favoriteSire ? horses.filter((horse) => horse.sire === state.filters.favoriteSire) : horses;
  const sireScopedHorses = state.filters.favoriteBirthYear ? horses.filter((horse) => String(horse.birthYear || "") === state.filters.favoriteBirthYear) : horses;
  const sires = [...new Set(sireScopedHorses.map((horse) => horse.sire).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
  const birthYears = [...new Set(yearScopedHorses.map((horse) => String(horse.birthYear || "")).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  return `
    <div class="detail-filters">
      <select class="filter-select favorite-year-select" data-favorite-filter="birthYear" aria-label="生年">
        <option value="">全生年（${yearScopedHorses.length}）</option>
        ${favoriteHistoryOptionsHtml({
          values: birthYears,
          recentValue: state.filters.recentFavoriteBirthYear,
          selectedValue: state.filters.favoriteBirthYear,
          label: (year) => `${year}年産（${yearScopedHorses.filter((horse) => String(horse.birthYear || "") === year).length}）`
        })}
      </select>
      <select class="filter-select favorite-sire-select" data-favorite-filter="sire" aria-label="種牡馬">
        <option value="">全種牡馬（${sireScopedHorses.length}）</option>
        ${favoriteHistoryOptionsHtml({
          values: sires,
          recentValue: state.filters.recentFavoriteSire,
          selectedValue: state.filters.favoriteSire,
          label: (sire) => `${sire}（${sireScopedHorses.filter((horse) => horse.sire === sire).length}）`
        })}
      </select>
      <button type="button" class="filter-chip hall-filter-toggle ${state.filters.favoriteHallOnly ? "active" : ""}" data-toggle-favorite-hall title="殿堂入りのみ" aria-label="殿堂入りのみ">♛ ${hallPhotoCount}</button>
    </div>
  `;
}

function favoriteHistoryOptionsHtml({ values, recentValue, selectedValue, label }) {
  const recent = recentValue && values.includes(recentValue)
    ? `<option value="${escapeHtml(recentValue)}" ${selectedValue === recentValue ? "selected" : ""}>${escapeHtml(label(recentValue))}</option><option disabled>────────</option>`
    : "";
  return `${recent}${values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label(value))}</option>`).join("")}`;
}

function renderFavoriteDetail(focusPhotoKey = "") {
  const photos = filteredFavoritePhotos();
  const title = state.filters.favoriteHallOnly ? `殿堂入り（${photos.length}）` : `お気に入り（${photos.length}）`;
  detail.innerHTML = `
    <div class="horse-head">
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${favoriteDetailFiltersHtml()}
      </div>
    </div>
    <div class="photos">
      ${photos.map((photo) => photoCard(photo, { context: "favorite", focused: photo.key === focusPhotoKey })).join("") || `<div class="empty">${state.filters.favoriteHallOnly ? "殿堂入りはまだありません。" : "お気に入りはまだありません。"}</div>`}
    </div>
  `;
  if (focusPhotoKey) detail.querySelector(`[data-photo-card-key="${cssEscape(focusPhotoKey)}"]`)?.scrollIntoView({ block: "center" });
}

function photoCard(photo, options = {}) {
  const { context = "horse", focused = false, baseName = "" } = options;
  const src = photo.localImagePath ? `data/${photo.localImagePath}` : photo.imageUrl;
  const horse = horseById(photo.horseId);
  const adjustment = photoAdjustment(photo.key);
  const adjustmentOpen = state.activePhotoAdjustment === photo.key;
  const result = raceResultForPhoto(photo);
  const finish = resultFinishLabel(result);
  const bodyWeight = resultBodyWeightLabel(result);
  const raceCaption = [photo.raceDate || photo.photoDate, photo.raceName].filter(Boolean).join(" ");
  const caption = context === "race" || context === "raceHistory" || context === "favorite" || context === "offspring"
    ? horse?.name || ""
    : raceCaption || photo.caption || "";
  const meta = context === "raceHistory"
    ? raceCaption
    : (context === "favorite" || context === "offspring") && state.viewMode === "oneComments" ? raceCaption : "";
  const subMeta = photoCardSubMeta({ context, horse, baseName });
  const hall = hasHallOfFameHorse(photo.horseId);
  const captionButton = context === "race" || context === "raceHistory" || context === "favorite" || context === "offspring"
    ? `<button type="button" class="caption-link" data-open-horse-id="${escapeHtml(photo.horseId)}">${escapeHtml(caption || photo.source)}</button>`
    : context === "horse" && photo.raceKey
      ? `<button type="button" class="caption-link" data-open-race-key="${escapeHtml(photo.raceKey)}">${escapeHtml(caption || photo.source)}</button>`
      : `<span>${escapeHtml(caption || photo.source)}</span>`;
  const status = photoStatus(photo);
  return `
    <article class="photo-card ${focused ? "focused" : ""}" data-photo-card-key="${escapeHtml(photo.key)}">
      ${src ? `
        <div class="photo-image-frame" style="--photo-scale: ${adjustment.scale}; --photo-x: ${adjustment.x}%; --photo-y: ${adjustment.y}%;">
          <img src="${src}" alt="${escapeHtml(caption)}" loading="lazy">
        </div>
      ` : ""}
      <div class="photo-body">
        <div class="caption-row">
          <p class="caption">${captionButton}</p>
          <div class="photo-actions">
            ${finish
              ? `<button type="button" class="finish-label ${adjustmentOpen ? "active" : ""}" data-photo-adjust-id="${escapeHtml(photo.key)}" data-photo-adjust-action="toggle" title="写真位置調整" aria-label="写真位置調整">${escapeHtml(finish)}</button>`
              : `<button type="button" class="photo-adjust-toggle empty ${adjustmentOpen ? "active" : ""}" data-photo-adjust-id="${escapeHtml(photo.key)}" data-photo-adjust-action="toggle" title="写真位置調整" aria-label="写真位置調整">調整</button>`}
            <button type="button" class="hall-status-button ${hall ? "active" : ""}" data-toggle-hall-id="${escapeHtml(photo.horseId)}" title="${hall ? "殿堂入りを解除" : "殿堂入りにする"}" aria-label="${hall ? "殿堂入りを解除" : "殿堂入りにする"}">♛</button>
            <button type="button" class="photo-status-button ${escapeHtml(status)}" data-photo-status-id="${escapeHtml(photo.key)}" title="${escapeHtml(photoStatusLabel(status))}" aria-label="${escapeHtml(photoStatusLabel(status))}">${photoStatusIcon(status)}</button>
          </div>
        </div>
        ${adjustmentOpen ? photoAdjustmentControls(photo.key, adjustment) : ""}
        ${subMeta || bodyWeight ? `<p class="photo-meta pedigree-meta"><span>${escapeHtml(subMeta)}</span><span>${escapeHtml(bodyWeight)}</span></p>` : ""}
        ${photoCardBodyTags(context, horse)}
        ${meta ? `<p class="photo-meta">${escapeHtml(meta)}</p>` : ""}
        ${state.viewMode === "oneComments" && photo.comment ? `<p class="comment">${escapeHtml(photo.comment)}</p>` : ""}
      </div>
    </article>
  `;
}

function photoAdjustmentControls(photoKey, adjustment) {
  return `
    <div class="photo-adjust-controls">
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="zoomOut" title="縮小">−</button>
      <span>${Math.round(adjustment.scale * 100)}%</span>
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="zoomIn" title="拡大">＋</button>
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="left" title="左へ">←</button>
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="right" title="右へ">→</button>
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="up" title="上へ">↑</button>
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="down" title="下へ">↓</button>
      <button type="button" data-photo-adjust-id="${escapeHtml(photoKey)}" data-photo-adjust-action="reset" title="リセット">リセット</button>
    </div>
  `;
}

function raceResultForPhoto(photo) {
  if (!photo?.raceKey) return null;
  const horse = horseById(photo.horseId);
  const raceResult = state.raceResults?.races?.[photo.raceKey] || state.raceResults?.races?.[normalizedResultRaceKey(photo)];
  if (!horse || !raceResult) return null;
  const result = raceResult.entriesByHorseId?.[photo.horseId] || raceResult.entries?.[horse.name] || null;
  if (result) return result;
  const entries = Object.keys(raceResult.entries || {});
  return entries.length ? { finish: "", status: "withdrawn", bodyWeight: "" } : null;
}

function normalizedResultRaceKey(photo) {
  const year = String(photo.raceKey || "").split(":")[0] || (photo.raceDate || photo.photoDate || "").slice(0, 4);
  return year && photo.raceName ? `${year}:${normalizeResultRaceName(photo.raceName)}` : "";
}

function normalizeResultRaceName(name = "") {
  const normalized = String(name)
    .normalize("NFKC")
    .replace(/[（）]/g, (char) => ({ "（": "(", "）": ")" })[char])
    .replace(/\s+/g, "");
  const aliases = {
    "AR共和国杯": "アルゼンチン共和国杯",
    "東京優駿": "日本ダービー",
    "ダービー": "日本ダービー",
    "優駿牝馬": "オークス",
    "NHKマイルC": "NHKマイルカップ",
    "天皇賞春": "天皇賞・春",
    "天皇賞秋": "天皇賞・秋",
    "天皇賞(春)": "天皇賞・春",
    "天皇賞(秋)": "天皇賞・秋",
    "マイルチャンピオンS": "マイルCS",
    "マイルチャンピオンシップ": "マイルCS",
    "ジャパンC": "ジャパンカップ",
    "ジャパンカップ(芝)": "ジャパンカップ",
    "ジャパンCダート": "ジャパンカップダート",
    "JCダート": "ジャパンカップダート",
    "ジャパンカップ(ダート)": "ジャパンカップダート",
    "マイラーズカップ": "マイラーズC",
    "クイーンカップ": "クイーンC",
    "阪神ジュべナイルフィリーズ": "阪神ジュベナイルF",
    "阪神ジュベナイルフィリーズ": "阪神ジュベナイルF",
    "産経大阪杯": "大阪杯"
  };
  return aliases[normalized] || normalized;
}

function resultFinishLabel(result) {
  if (!result) return "";
  if (result.status === "withdrawn") return "回避";
  if (result.status === "scratched") return "取消";
  if (result.status === "stopped") return "中止";
  if (result.status === "excluded") return "除外";
  if (result.finish === undefined || result.finish === null || result.finish === "") return "";
  const finish = String(result.finish);
  return /着|同着|中止|取消|除外/.test(finish) ? finish : `${finish}着`;
}

function resultBodyWeightLabel(result) {
  if (!result) return "";
  if (result.bodyWeight !== undefined && result.bodyWeight !== null && result.bodyWeight !== "") return `${result.bodyWeight}kg`;
  return "";
}

function photoCardSubMeta({ context, horse, baseName }) {
  if (!horse) return "";
  if (context === "favorite" || context === "race" || context === "raceHistory") {
    return horse.sire ? `父 ${horse.sire}` : "";
  }
  if (context === "offspring") {
    if (baseName && horse.sire === baseName) return horse.damsire ? `母父 ${horse.damsire}` : "";
    if (baseName && horse.dam === baseName) return horse.sire ? `父 ${horse.sire}` : "";
  }
  return "";
}

function photoCardBodyTags(context, horse) {
  if (!horse || !["race", "raceHistory", "favorite"].includes(context)) return "";
  const html = bodyTagChips(horse);
  return html ? `<div class="photo-card-tags">${html}</div>` : "";
}

function horseSearchResult(query = state.query || state.filters.horseTouch) {
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

  const offspringMatches = horses.filter((horse) => equalsText(horse.dam) || equalsText(horse.sire)).sort(favoriteBirthYearSort);
  const offspringName = matchedPedigreeName(offspringMatches, equalsText, ["sire", "dam"]) || query;

  addSection("", horses.filter((horse) => equalsText(horse.name)).sort(birthYearSort));
  addSection("産駒", offspringMatches, { offspringHorseName: offspringName });
  addSection(`母父 ${query}`, horses.filter((horse) => equalsText(horse.damsire)).sort(favoriteBirthYearSort));
  addSection("馬名を含む", horses.filter((horse) => matchesText(horse.name)).sort(birthYearSort));
  addSection("血統に含む", horses
    .filter((horse) => [horse.sire, horse.dam, horse.damsire].some(matchesText))
    .sort(birthYearSort));

  return { all: sections.flatMap((section) => section.items), sections };
}

function globalSearchSections(query) {
  const horseSections = horseSearchResult(query).sections.map((section) => ({ ...section, type: "horse" }));
  const raceSection = {
    title: "レース",
    type: "race",
    items: raceMatches(query)
  };
  const favoriteSection = {
    title: "お気に入り",
    type: "favorite",
    items: favoritePhotoMatches(query)
  };
  const blocks = state.mode === "favorites"
    ? [favoriteSection, ...horseSections, raceSection]
    : state.mode === "race"
      ? [raceSection, ...horseSections, favoriteSection]
      : [...horseSections, raceSection, favoriteSection];

  return blocks.filter((section) => section.items.length);
}

function raceMatches(query) {
  const normalizedQuery = normalizeTouchText(query);
  return races().filter((race) => {
    const values = [race.name, race.date].filter(Boolean);
    return values.some((value) => normalizeTouchText(value).includes(normalizedQuery));
  });
}

function favoritePhotoMatches(query) {
  const normalizedQuery = normalizeTouchText(query);
  return state.db.photos
    .filter((photo) => state.favorites.has(photo.key))
    .filter((photo) => {
      const horse = horseById(photo.horseId);
      return [horse?.name, photo.raceName, photo.raceDate, photo.caption]
        .some((value) => normalizeTouchText(value || "").includes(normalizedQuery));
    })
    .sort(favoritePhotoSort);
}

function bodyTagChips(horse) {
  const tags = (horse.bodyTags || []).slice(0, 10);
  if (!tags.length) return "";
  return `
    <div class="body-tags">
      ${tags.map((item) => `
        <span class="body-tag ${item.confidence === "confirmed" ? "confirmed" : "suggested"}" title="${escapeHtml(bodyTagTitle(item))}">
          ${escapeHtml(bodyTagLabel(item.tag))}
        </span>
      `).join("")}
    </div>
  `;
}

function bodyTagLabel(tag) {
  const labels = {
    "繋ぎ立ち": "立繋",
    "胴詰まり": "胴詰",
    "繋ぎ柔らか": "柔繋",
    "肩立ち": "肩立"
  };
  return labels[tag] || tag;
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
  addSection("産駒", offspringForHorse(horse).sort(favoriteBirthYearSort), { offspringHorseId: horse.id });
  addSection(`母父 ${horse.name}`, state.db.horses.filter((item) => item.damsire === horse.name).sort(favoriteBirthYearSort));

  return { all: sections.flatMap((section) => section.items), sections };
}

function horseNameContextResult(name) {
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

  addSection("産駒", offspringForName(name).sort(favoriteBirthYearSort), { offspringHorseName: name });
  addSection(`母父 ${name}`, state.db.horses.filter((item) => item.damsire === name).sort(favoriteBirthYearSort));

  return { all: sections.flatMap((section) => section.items), sections };
}

function filteredRaces() {
  const query = state.query;
  return races().filter((race) => {
    if (query && !race.name.includes(query)) return false;
    if (state.filters.raceGrade && raceGrade(race) !== state.filters.raceGrade) return false;
    if (state.filters.raceYear && !race.date?.startsWith(state.filters.raceYear)) return false;
    if (state.filters.raceName && race.name !== state.filters.raceName) return false;
    return true;
  });
}

function filteredFavoritePhotos() {
  const query = state.query;
  return favoritePhotos()
    .filter((photo) => {
      const horse = horseById(photo.horseId);
      if (state.filters.favoriteHallOnly && !hasHallOfFameHorse(photo.horseId)) return false;
      if (state.filters.favoriteTouch && !normalizeTouchText(horse?.name || "").includes(state.filters.favoriteTouch)) return false;
      if (state.filters.favoriteSire && horse?.sire !== state.filters.favoriteSire) return false;
      if (state.filters.favoriteBirthYear && String(horse?.birthYear || "") !== state.filters.favoriteBirthYear) return false;
      if (!query) return true;
      return [horse?.name, photo.raceName, photo.raceDate, photo.caption].some((value) => value?.includes(query));
    })
    .sort(favoritePhotoSort);
}

function favoritePhotos() {
  return state.db.photos.filter((photo) => state.favorites.has(photo.key));
}

function uniqueHorses(horses) {
  const seen = new Set();
  return horses.filter((horse) => {
    if (!horse || seen.has(horse.id)) return false;
    seen.add(horse.id);
    return true;
  });
}

function filteredHorses() {
  const query = state.filters.horseTouch;
  if (!query) return state.db.horses;
  return state.db.horses.filter((horse) => horseSearchFields(horse).some((value) => normalizeTouchText(value).includes(query)));
}

function races() {
  if (racesCache) return racesCache;
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
  racesCache = [...grouped.values()]
    .map((race) => ({ ...race, photos: race.photos.sort(photoSort) }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name, "ja"));
  return racesCache;
}

function photosForHorse(horseId) {
  return state.db.photos
    .filter((photo) => photo.horseId === horseId)
    .sort(photoSort);
}

function favoritePhotosForHorse(horseId) {
  return photosForHorse(horseId).filter((photo) => state.favorites.has(photo.key));
}

function hasFavoriteHorse(horseId) {
  return state.db.photos.some((photo) => photo.horseId === horseId && state.favorites.has(photo.key));
}

function hasHallOfFameHorse(horseId) {
  return state.hallOfFame.has(horseId);
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
  return offspringForName(horse.name);
}

function offspringForName(name) {
  return state.db.horses.filter((item) => item.dam === name || item.sire === name);
}

function matchedPedigreeName(items, matches, fields) {
  for (const item of items) {
    for (const field of fields) {
      const value = item[field];
      if (value && matches(value)) return value;
    }
  }
  return "";
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
  return Boolean(state.filters.raceGrade || state.filters.raceYear || state.filters.raceName);
}

function hasFavoriteFilters() {
  return Boolean(state.filters.favoriteTouch || state.filters.favoriteSire || state.filters.favoriteBirthYear || state.filters.favoriteHallOnly);
}

function isG1Race(name = "") {
  return G1_RACES.includes(String(name));
}

function raceNameFilterOptions(baseRaces, availableRaceNames) {
  if (!state.filters.raceGrade) {
    return G1_RACES.filter((name) => availableRaceNames.has(name));
  }
  const names = [...new Set(baseRaces
    .filter((race) => availableRaceNames.has(race.name))
    .map((race) => race.name)
  )];
  const preferred = GRADE_RACES[state.filters.raceGrade] || [];
  return names.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return latestRaceDateForName(b).localeCompare(latestRaceDateForName(a)) || a.localeCompare(b, "ja");
  });
}

function latestRaceDateForName(name) {
  return races()
    .filter((race) => race.name === name)
    .map((race) => race.date || "")
    .sort((a, b) => b.localeCompare(a))[0] || "";
}

function raceGrade(race) {
  const resultRace = resultRaceForRace(race);
  if (resultRace?.grade) return resultRace.grade;
  return gradeByRaceName(race.name);
}

function resultRaceForRace(race) {
  if (!race) return null;
  const direct = state.raceResults?.races?.[race.key];
  if (direct) return direct;
  const year = String(race.key || "").split(":")[0] || (race.date || "").slice(0, 4);
  const normalizedKey = year && race.name ? `${year}:${normalizeResultRaceName(race.name)}` : "";
  return normalizedKey ? state.raceResults?.races?.[normalizedKey] || null : null;
}

function gradeByRaceName(name = "") {
  for (const [grade, names] of Object.entries(GRADE_RACES)) {
    if (names.includes(String(name))) return grade;
  }
  return "";
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

function favoriteBirthYearSort(a, b) {
  const favoriteDiff = Number(hasFavoriteHorse(b.id)) - Number(hasFavoriteHorse(a.id));
  return favoriteDiff || birthYearSort(a, b);
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

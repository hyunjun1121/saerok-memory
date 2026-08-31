const sentenceList = document.querySelector("#sentence-list");
const template = document.querySelector("#sentence-template");
const loadError = document.querySelector("#load-error");
const emptyFilter = document.querySelector("#empty-filter");
const progressText = document.querySelector("[data-testid='selection-progress']");
const progressBar = document.querySelector("#selection-progress");
const saveStatus = document.querySelector("#save-status");
const completionMessage = document.querySelector("#completion-message");
const nextUnselectedButton = document.querySelector("#next-unselected");
const exportButton = document.querySelector("#export-selections");
const introGreeting = document.querySelector("#intro-greeting");
const introVariantList = document.querySelector("#intro-variant-list");

const state = {
  inventory: null,
  introInventory: null,
  introChoice: null,
  choices: {},
  filter: "all",
  activeAudio: null,
  activeButton: null,
  saveQueue: Promise.resolve(),
};

const INTRO_CHOICE_KEY = "haru-day1-ja-intro-choice";

function assertInventory(inventory) {
  if (!inventory || inventory.schemaVersion !== 2 || inventory.locale !== "ja") {
    throw new Error("日本語 Day 1 インベントリの形式が正しくありません。");
  }
  if (!Array.isArray(inventory.voiceCandidates) || inventory.voiceCandidates.length !== 3) {
    throw new Error("3つの音声候補が必要です。");
  }
  if (!Array.isArray(inventory.entries) || inventory.entryCount !== inventory.entries.length) {
    throw new Error("日本語 Day 1 の文一覧が正しくありません。");
  }
  return inventory;
}

function assertIntroInventory(inventory) {
  if (!inventory || inventory.schemaVersion !== 1 || inventory.locale !== "ja" || typeof inventory.text !== "string") {
    throw new Error("起動時の日本語音声候補の形式が正しくありません。");
  }
  if (!Array.isArray(inventory.voiceCandidates) || inventory.voiceCandidates.length !== 3) {
    throw new Error("起動時音声には3つの声が必要です。");
  }
  if (!Array.isArray(inventory.variants) || inventory.variants.length !== 4) {
    throw new Error("起動時音声には4つのタグ候補が必要です。");
  }
  for (const variant of inventory.variants) {
    if (!variant || typeof variant.id !== "string" || typeof variant.taggedText !== "string" || !Array.isArray(variant.candidates) || variant.candidates.length !== 3) {
      throw new Error("起動時音声の候補が正しくありません。");
    }
  }
  return inventory;
}

function readIntroChoice() {
  try {
    const value = window.localStorage.getItem(INTRO_CHOICE_KEY);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveIntroChoice(value) {
  state.introChoice = value;
  try {
    window.localStorage.setItem(INTRO_CHOICE_KEY, value);
  } catch {
    // The selector still works when localStorage is unavailable.
  }
}

function choicesFromDocument(documentValue) {
  if (!documentValue || documentValue.schemaVersion !== 1 || documentValue.locale !== "ja" || !Array.isArray(documentValue.selections)) return {};
  return Object.fromEntries(documentValue.selections.flatMap((selection) => (
    typeof selection?.id === "string" && typeof selection?.voiceId === "string"
      ? [[selection.id, selection.voiceId]]
      : []
  )));
}

function setSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("is-error", isError);
}

function resetPlayButton(button) {
  if (!button) return;
  button.classList.remove("is-playing");
  button.querySelector(".play-button__icon").textContent = "▶";
  button.querySelector(".play-button__label").textContent = "再生";
  button.setAttribute("aria-pressed", "false");
}

function pauseActiveAudio() {
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio.currentTime = 0;
  }
  resetPlayButton(state.activeButton);
  state.activeAudio = null;
  state.activeButton = null;
}

async function toggleAudio(button) {
  const candidate = button.closest(".candidate");
  const audio = candidate.querySelector("audio");
  const status = candidate.querySelector(".candidate__status");
  if (state.activeAudio === audio && !audio.paused) {
    pauseActiveAudio();
    status.textContent = "";
    return;
  }
  pauseActiveAudio();
  state.activeAudio = audio;
  state.activeButton = button;
  button.classList.add("is-playing");
  button.querySelector(".play-button__icon").textContent = "Ⅱ";
  button.querySelector(".play-button__label").textContent = "再生中";
  button.setAttribute("aria-pressed", "true");
  status.textContent = "";
  try {
    await audio.play();
  } catch {
    if (state.activeAudio === audio) pauseActiveAudio();
    status.textContent = "音声ファイルをまだ準備できていません。";
  }
}

function selectedCount() {
  return Object.keys(state.choices).length;
}

function rowMatchesFilter(row) {
  const choice = state.choices[row.dataset.entryId];
  if (state.filter === "unselected") return !choice;
  if (state.filter === "selected") return Boolean(choice);
  if (["ank0", "minami", "veteran"].includes(state.filter)) return choice === state.filter;
  return true;
}

function applyFilter() {
  let visibleCount = 0;
  for (const row of sentenceList.querySelectorAll("[data-testid='tts-row']")) {
    const matches = rowMatchesFilter(row);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
    if (!matches && row.contains(state.activeAudio)) pauseActiveAudio();
  }
  emptyFilter.hidden = visibleCount !== 0;
}

function updateSelectionVisuals() {
  for (const row of sentenceList.querySelectorAll("[data-testid='tts-row']")) {
    const choice = state.choices[row.dataset.entryId];
    for (const candidate of row.querySelectorAll(".candidate")) {
      const radio = candidate.querySelector("input[type='radio']");
      radio.checked = radio.value === choice;
      candidate.classList.toggle("is-selected", radio.checked);
    }
  }
  applyFilter();
}

function updateProgress() {
  const count = selectedCount();
  const total = state.inventory.entryCount;
  progressText.textContent = `${count} / ${total}`;
  progressBar.value = count;
  progressBar.max = total;
  progressBar.textContent = `${count} / ${total}`;
  completionMessage.hidden = count !== total;
  exportButton.disabled = count !== total;
  nextUnselectedButton.disabled = count === total;
}

function renderState() {
  updateSelectionVisuals();
  updateProgress();
}

function persistChoices() {
  const snapshot = { ...state.choices };
  setSaveStatus("保存中…");
  state.saveQueue = state.saveQueue.catch(() => undefined).then(async () => {
    const response = await fetch("api/selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: snapshot }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `保存応答 ${response.status}`);
    }
    return response.json();
  }).then((documentValue) => {
    if (selectedCount() === documentValue.selectedCount) setSaveStatus(`${documentValue.selectedCount}文を保存しました`);
    return documentValue;
  }).catch((error) => {
    setSaveStatus(`保存に失敗しました: ${error.message}`, true);
    throw error;
  });
  state.saveQueue.catch(() => {});
}

function selectChoice(radio) {
  const row = radio.closest("[data-testid='tts-row']");
  state.choices[row.dataset.entryId] = radio.value;
  renderState();
  persistChoices();
}

function createCandidate(entry, voice, candidate) {
  const section = document.createElement("section");
  section.className = "candidate";
  section.dataset.voiceId = voice.id;

  const heading = document.createElement("div");
  heading.className = "candidate__heading";
  const title = document.createElement("strong");
  title.textContent = voice.label;
  const description = document.createElement("span");
  description.textContent = voice.description;
  heading.append(title, description);

  const audio = document.createElement("audio");
  audio.preload = "none";
  audio.src = candidate.targetPath;
  audio.dataset.entryId = entry.id;

  const playButton = document.createElement("button");
  playButton.className = "play-button";
  playButton.type = "button";
  playButton.dataset.action = "play";
  playButton.setAttribute("aria-label", `${entry.index}番文 ${voice.label}を再生`);
  playButton.setAttribute("aria-pressed", "false");
  const playIcon = document.createElement("span");
  playIcon.className = "play-button__icon";
  playIcon.setAttribute("aria-hidden", "true");
  playIcon.textContent = "▶";
  const playLabel = document.createElement("span");
  playLabel.className = "play-button__label";
  playLabel.textContent = "再生";
  playButton.append(playIcon, playLabel);
  playButton.addEventListener("click", () => toggleAudio(playButton));

  const selectLabel = document.createElement("label");
  selectLabel.className = "select-button";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.value = voice.id;
  radio.name = `choice:${entry.id}`;
  radio.setAttribute("aria-label", `${entry.index}番文 ${voice.label}を選択`);
  radio.addEventListener("change", () => selectChoice(radio));
  const mark = document.createElement("span");
  mark.className = "select-button__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✓";
  const selectText = document.createElement("span");
  selectText.textContent = "この声を選ぶ";
  selectLabel.append(radio, mark, selectText);

  const status = document.createElement("p");
  status.className = "candidate__status";
  status.setAttribute("role", "status");
  audio.addEventListener("ended", () => { if (state.activeAudio === audio) pauseActiveAudio(); });
  audio.addEventListener("error", () => {
    status.textContent = "音声ファイルは生成待ちです。";
    if (state.activeAudio === audio) pauseActiveAudio();
  });

  section.append(heading, audio, playButton, selectLabel, status);
  return section;
}

function createIntroCandidate(variant, voice, candidate) {
  const section = document.createElement("section");
  section.className = "candidate intro-candidate";
  section.dataset.voiceId = voice.id;
  section.dataset.introChoice = `${variant.id}:${voice.id}`;

  const heading = document.createElement("div");
  heading.className = "candidate__heading";
  const title = document.createElement("strong");
  title.textContent = voice.label;
  const description = document.createElement("span");
  description.textContent = voice.description;
  heading.append(title, description);

  const audio = document.createElement("audio");
  audio.preload = "none";
  audio.src = candidate.targetPath;

  const playButton = document.createElement("button");
  playButton.className = "play-button";
  playButton.type = "button";
  playButton.dataset.action = "play-intro";
  playButton.setAttribute("aria-label", `${variant.label} ${voice.label}を再生`);
  playButton.setAttribute("aria-pressed", "false");
  const playIcon = document.createElement("span");
  playIcon.className = "play-button__icon";
  playIcon.setAttribute("aria-hidden", "true");
  playIcon.textContent = "▶";
  const playLabel = document.createElement("span");
  playLabel.className = "play-button__label";
  playLabel.textContent = "再生";
  playButton.append(playIcon, playLabel);
  playButton.addEventListener("click", () => toggleAudio(playButton));

  const selectLabel = document.createElement("label");
  selectLabel.className = "select-button";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.value = `${variant.id}:${voice.id}`;
  radio.name = "intro-choice";
  radio.checked = state.introChoice === radio.value;
  radio.setAttribute("aria-label", `${variant.label} ${voice.label}を選択`);
  radio.addEventListener("change", () => {
    saveIntroChoice(radio.value);
    updateIntroVisuals();
  });
  const mark = document.createElement("span");
  mark.className = "select-button__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✓";
  const selectText = document.createElement("span");
  selectText.textContent = "この候補を選ぶ";
  selectLabel.append(radio, mark, selectText);

  const status = document.createElement("p");
  status.className = "candidate__status";
  status.setAttribute("role", "status");
  if (candidate.status !== "ready") status.textContent = "音声ファイルは生成待ちです。";
  audio.addEventListener("ended", () => { if (state.activeAudio === audio) pauseActiveAudio(); });
  audio.addEventListener("error", () => {
    status.textContent = "音声ファイルは生成待ちです。";
    if (state.activeAudio === audio) pauseActiveAudio();
  });

  section.append(heading, audio, playButton, selectLabel, status);
  return section;
}

function updateIntroVisuals() {
  for (const candidate of introVariantList.querySelectorAll(".intro-candidate")) {
    const selected = candidate.dataset.introChoice === state.introChoice;
    candidate.classList.toggle("is-selected", selected);
    const radio = candidate.querySelector("input[type='radio']");
    if (radio) radio.checked = selected;
  }
}

function renderIntroGreeting() {
  if (!state.introInventory) return;
  const fragment = document.createDocumentFragment();
  for (const variant of state.introInventory.variants) {
    const article = document.createElement("article");
    article.className = "intro-variant";
    const header = document.createElement("header");
    header.className = "intro-variant__header";
    const title = document.createElement("h3");
    title.textContent = variant.label;
    const tags = document.createElement("span");
    tags.textContent = variant.tags.map((tag) => `[${tag}]`).join(" ");
    header.append(title, tags);
    const description = document.createElement("p");
    description.className = "intro-variant__description";
    description.textContent = variant.description;
    const taggedText = document.createElement("p");
    taggedText.className = "intro-variant__text";
    taggedText.textContent = variant.taggedText;
    const grid = document.createElement("fieldset");
    grid.className = "candidate-grid intro-candidate-grid";
    const legend = document.createElement("legend");
    legend.className = "sr-only";
    legend.textContent = `${variant.label} 音声候補`;
    grid.append(legend);
    for (const voice of state.introInventory.voiceCandidates) {
      const candidate = variant.candidates.find((item) => item.voiceId === voice.id);
      if (candidate) grid.append(createIntroCandidate(variant, voice, candidate));
    }
    article.append(header, description, taggedText, grid);
    fragment.append(article);
  }
  introVariantList.replaceChildren(fragment);
  introVariantList.setAttribute("aria-busy", "false");
  introGreeting.hidden = false;
  updateIntroVisuals();
}

function createSentenceRow(entry) {
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector("[data-testid='tts-row']");
  row.dataset.entryId = entry.id;
  row.dataset.index = String(entry.index);
  row.querySelector(".sentence-number").textContent = String(entry.index).padStart(2, "0");
  row.querySelector(".sentence-id").textContent = entry.id;
  row.querySelector("[data-testid='entry-text']").textContent = entry.text;
  row.querySelector("legend").textContent = `${entry.index}番文のTTS選択`;
  const grid = row.querySelector(".candidate-grid");
  for (const voice of state.inventory.voiceCandidates) {
    const candidate = entry.candidates.find((item) => item.voiceId === voice.id);
    if (candidate) grid.append(createCandidate(entry, voice, candidate));
  }
  return fragment;
}

function renderSentences() {
  const fragment = document.createDocumentFragment();
  for (const entry of state.inventory.entries) fragment.append(createSentenceRow(entry));
  sentenceList.replaceChildren(fragment);
  sentenceList.setAttribute("aria-busy", "false");
  renderState();
}

function setFilter(button) {
  state.filter = button.dataset.filter;
  for (const filterButton of document.querySelectorAll("[data-filter]")) {
    const active = filterButton === button;
    filterButton.classList.toggle("is-active", active);
    filterButton.setAttribute("aria-pressed", String(active));
  }
  applyFilter();
}

function scrollToNextUnselected() {
  const row = [...sentenceList.querySelectorAll("[data-testid='tts-row']")].find((candidate) => !state.choices[candidate.dataset.entryId]);
  if (!row) return;
  if (row.hidden) setFilter(document.querySelector("[data-filter='all']"));
  row.scrollIntoView({ behavior: "smooth", block: "start" });
  row.querySelector("[data-action='play']").focus({ preventScroll: true });
}

async function exportSelections() {
  try {
    await state.saveQueue;
    const response = await fetch("api/selections", { cache: "no-store" });
    if (!response.ok) throw new Error(`出力応答 ${response.status}`);
    const selectionDocument = await response.json();
    if (!selectionDocument.complete) throw new Error("31文すべて選択してください。");
    const blob = new Blob([`${JSON.stringify(selectionDocument, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "haru-day1-ja-tts-selections.json";
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus("選択結果JSONを保存しました");
  } catch (error) {
    setSaveStatus(`出力に失敗しました: ${error.message}`, true);
  }
}

for (const button of document.querySelectorAll("[data-filter]")) button.addEventListener("click", () => setFilter(button));
nextUnselectedButton.addEventListener("click", scrollToNextUnselected);
exportButton.addEventListener("click", exportSelections);
window.addEventListener("beforeunload", pauseActiveAudio);

async function initialize() {
  try {
    const [inventoryResponse, selectionsResponse, introResponse] = await Promise.all([
      fetch("day1-inventory.json", { cache: "no-store" }),
      fetch("api/selections", { cache: "no-store" }),
      fetch("start-greeting-inventory.json", { cache: "no-store" }),
    ]);
    if (!inventoryResponse.ok) throw new Error(`文一覧応答 ${inventoryResponse.status}`);
    if (!selectionsResponse.ok) throw new Error(`選択記録応答 ${selectionsResponse.status}`);
    if (!introResponse.ok) throw new Error(`起動時音声一覧応答 ${introResponse.status}`);
    state.inventory = assertInventory(await inventoryResponse.json());
    state.choices = choicesFromDocument(await selectionsResponse.json());
    state.introInventory = assertIntroInventory(await introResponse.json());
    state.introChoice = readIntroChoice();
    renderIntroGreeting();
    renderSentences();
    setSaveStatus(selectedCount() > 0 ? `${selectedCount()}文の選択を復元しました` : "選択結果はこの端末に保存されます。");
  } catch (error) {
    sentenceList.setAttribute("aria-busy", "false");
    loadError.hidden = false;
    loadError.textContent = `ページを準備できませんでした: ${error.message}`;
  }
}

initialize();

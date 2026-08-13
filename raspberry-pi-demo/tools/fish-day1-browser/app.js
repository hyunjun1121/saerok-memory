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

const state = {
  inventory: null,
  choices: {},
  filter: "all",
  activeAudio: null,
  activeButton: null,
  saveQueue: Promise.resolve(),
};

function assertInventory(inventory) {
  if (!inventory || inventory.schemaVersion !== 1 || inventory.locale !== "ko") {
    throw new Error("Day 1 인벤토리 형식이 올바르지 않습니다.");
  }
  if (!Array.isArray(inventory.entries) || inventory.entries.length !== inventory.entryCount) {
    throw new Error("Day 1 문장 목록이 올바르지 않습니다.");
  }
  return inventory;
}

function choicesFromDocument(document) {
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.selections)) return {};
  return Object.fromEntries(document.selections.flatMap((selection) => {
    if (selection?.choice !== "left" && selection?.choice !== "right") return [];
    return [[selection.id, selection.choice]];
  }));
}

function setSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("is-error", isError);
}

function resetPlayButton(button) {
  if (!button) return;
  button.classList.remove("is-playing");
  button.querySelector(".play-button__icon").textContent = "▶";
  button.querySelector(".play-button__label").textContent = `${button.dataset.side === "left" ? "A" : "B"}안 듣기`;
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
  status.textContent = "";
  state.activeAudio = audio;
  state.activeButton = button;
  button.classList.add("is-playing");
  button.querySelector(".play-button__icon").textContent = "Ⅱ";
  button.querySelector(".play-button__label").textContent = `${button.dataset.side === "left" ? "A" : "B"}안 재생 중`;
  button.setAttribute("aria-pressed", "true");

  try {
    await audio.play();
  } catch {
    if (state.activeAudio === audio) pauseActiveAudio();
    status.textContent = "재생할 수 없습니다. 파일을 다시 확인해 주세요.";
  }
}

function selectedCount() {
  return Object.keys(state.choices).length;
}

function rowMatchesFilter(row) {
  const choice = state.choices[row.dataset.entryId];
  if (state.filter === "unselected") return !choice;
  if (state.filter === "selected") return Boolean(choice);
  if (state.filter === "left" || state.filter === "right") return choice === state.filter;
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
  setSaveStatus("선택 저장 중…");
  state.saveQueue = state.saveQueue.catch(() => undefined).then(async () => {
    const response = await fetch("api/selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: snapshot }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `저장 응답 ${response.status}`);
    }
    return response.json();
  }).then((document) => {
    if (selectedCount() === document.selectedCount) {
      setSaveStatus(`${document.selectedCount}개 선택 저장됨`);
    }
    return document;
  }).catch((error) => {
    setSaveStatus(`저장 실패: ${error.message}`, true);
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

function createSentenceRow(entry) {
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector("[data-testid='tts-row']");
  row.dataset.entryId = entry.id;
  row.dataset.index = String(entry.index);
  row.querySelector(".sentence-number").textContent = String(entry.index).padStart(2, "0");
  row.querySelector(".sentence-id").textContent = entry.id;
  row.querySelector("[data-testid='entry-text']").textContent = entry.text;
  row.querySelector("legend").textContent = `${entry.index}번 문장의 TTS 선택`;

  for (const side of ["left", "right"]) {
    const candidate = row.querySelector(`.candidate--${side}`);
    const audio = candidate.querySelector("audio");
    const playButton = candidate.querySelector("[data-action='play']");
    const radio = candidate.querySelector("input[type='radio']");
    const label = side === "left" ? "A" : "B";
    const path = side === "left" ? entry.leftTargetPath : entry.rightTargetPath;

    audio.src = path;
    audio.dataset.entryId = entry.id;
    audio.addEventListener("ended", () => {
      if (state.activeAudio === audio) pauseActiveAudio();
    });
    audio.addEventListener("error", () => {
      candidate.querySelector(".candidate__status").textContent = "음원 파일을 불러오지 못했습니다.";
      if (state.activeAudio === audio) pauseActiveAudio();
    });

    playButton.setAttribute("aria-label", `${entry.index}번 문장 ${label}안 듣기`);
    playButton.setAttribute("aria-pressed", "false");
    playButton.addEventListener("click", () => toggleAudio(playButton));

    radio.name = `choice:${entry.id}`;
    radio.setAttribute("aria-label", `${entry.index}번 문장 ${label}안 선택`);
    radio.addEventListener("change", () => selectChoice(radio));
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
  const row = [...sentenceList.querySelectorAll("[data-testid='tts-row']")]
    .find((candidate) => !state.choices[candidate.dataset.entryId]);
  if (!row) return;
  if (row.hidden) setFilter(document.querySelector("[data-filter='all']"));
  row.scrollIntoView({ behavior: "smooth", block: "start" });
  row.querySelector("[data-action='play']").focus({ preventScroll: true });
}

async function exportSelections() {
  try {
    await state.saveQueue;
    const response = await fetch("api/selections", { cache: "no-store" });
    if (!response.ok) throw new Error(`내보내기 응답 ${response.status}`);
    const selectionDocument = await response.json();
    if (!selectionDocument.complete) throw new Error("모든 문장을 먼저 선택해 주세요.");

    const blob = new Blob([`${JSON.stringify(selectionDocument, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "haru-day1-tts-selections.json";
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus("선택 결과 JSON 내보내기 완료");
  } catch (error) {
    setSaveStatus(`내보내기 실패: ${error.message}`, true);
  }
}

for (const button of document.querySelectorAll("[data-filter]")) {
  button.addEventListener("click", () => setFilter(button));
}
nextUnselectedButton.addEventListener("click", scrollToNextUnselected);
exportButton.addEventListener("click", exportSelections);
window.addEventListener("beforeunload", pauseActiveAudio);

async function initialize() {
  try {
    const [inventoryResponse, selectionsResponse] = await Promise.all([
      fetch("day1-inventory.json", { cache: "no-store" }),
      fetch("api/selections", { cache: "no-store" }),
    ]);
    if (!inventoryResponse.ok) throw new Error(`문장 목록 응답 ${inventoryResponse.status}`);
    if (!selectionsResponse.ok) throw new Error(`선택 기록 응답 ${selectionsResponse.status}`);

    state.inventory = assertInventory(await inventoryResponse.json());
    state.choices = choicesFromDocument(await selectionsResponse.json());
    renderSentences();
    setSaveStatus(state.choices && selectedCount() > 0
      ? `${selectedCount()}개 기존 선택 복원됨`
      : "선택 결과는 이 컴퓨터에 바로 저장됩니다.");
  } catch (error) {
    sentenceList.setAttribute("aria-busy", "false");
    loadError.hidden = false;
    loadError.textContent = `페이지를 준비하지 못했습니다: ${error.message}`;
  }
}

initialize();

const optionList = document.querySelector("#option-list");
const optionTemplate = document.querySelector("#option-template");
const tagTemplate = document.querySelector("#tag-template");
const candidateTemplate = document.querySelector("#candidate-template");
const loadError = document.querySelector("#load-error");
const progressText = document.querySelector("[data-testid='selection-progress']");
const saveStatus = document.querySelector("#save-status");
const nextUnselectedButton = document.querySelector("#next-unselected");
const exportButton = document.querySelector("#export-selections");

const state = {
  manifest: null,
  choices: {},
  activeAudio: null,
  activeButton: null,
  saveQueue: Promise.resolve(),
};

function assertManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.locale !== "ko") {
    throw new Error("후보 목록 형식이 올바르지 않습니다.");
  }
  if (!Array.isArray(manifest.manualTags)
    || manifest.manualTags.length !== 3
    || !Array.isArray(manifest.options)
    || manifest.options.length !== 4
    || manifest.candidateCountPerOption !== 6) {
    throw new Error("후보 개수가 올바르지 않습니다.");
  }
  const paths = new Set();
  for (const option of manifest.options) {
    if (!Array.isArray(option.candidates) || option.candidates.length !== 6) {
      throw new Error(`${option?.text ?? "문구"}의 후보 개수가 올바르지 않습니다.`);
    }
    for (const path of option.candidates) {
      if (!/^audio\/[A-Za-z0-9._-]+\.mp3$/u.test(path) || paths.has(path)) {
        throw new Error("후보 음원 경로가 올바르지 않습니다.");
      }
      paths.add(path);
    }
  }
  return manifest;
}

function choicesFromDocument(document) {
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.selections)) return {};
  return Object.fromEntries(document.selections.flatMap((selection) => (
    typeof selection?.id === "string" && typeof selection?.audioPath === "string"
      ? [[selection.id, selection.audioPath]]
      : []
  )));
}

function candidateMetadata(path) {
  const filename = path.split("/").at(-1).replace(/\.mp3$/u, "");
  const resultSide = filename.endsWith("_left") ? "left" : "right";
  const tag = state.manifest.manualTags.find((item) => filename.includes(`_${item.id}_${resultSide}`));
  if (!tag) throw new Error(`태그를 확인할 수 없습니다: ${path}`);
  return { tag, resultSide };
}

function setSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("is-error", isError);
}

function resetPlayButton(button) {
  if (!button) return;
  button.classList.remove("is-playing");
  button.textContent = "듣기";
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
  const candidate = button.closest("[data-testid='candidate']");
  const audio = candidate.querySelector("audio");
  const status = candidate.querySelector(".audio-status");

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
  button.textContent = "정지";
  button.setAttribute("aria-pressed", "true");

  try {
    await audio.play();
  } catch {
    if (state.activeAudio === audio) pauseActiveAudio();
    status.textContent = "재생할 수 없습니다.";
  }
}

function selectedCount() {
  return Object.keys(state.choices).length;
}

function renderSelectionState() {
  for (const row of optionList.querySelectorAll("[data-testid='option-row']")) {
    const selectedPath = state.choices[row.dataset.optionId];
    const selectedCandidate = [...row.querySelectorAll("[data-testid='candidate']")]
      .find((candidate) => candidate.dataset.audioPath === selectedPath);
    for (const candidate of row.querySelectorAll("[data-testid='candidate']")) {
      const radio = candidate.querySelector("input[type='radio']");
      radio.checked = candidate.dataset.audioPath === selectedPath;
      candidate.classList.toggle("is-selected", radio.checked);
      candidate.querySelector(".select-control span").textContent = radio.checked ? "선택됨" : "선택";
    }
    const optionState = row.querySelector("[data-testid='option-state']");
    optionState.textContent = selectedCandidate ? "선택 완료" : "미선택";
    optionState.classList.toggle("is-complete", Boolean(selectedCandidate));
  }

  const count = selectedCount();
  const total = state.manifest.options.length;
  progressText.textContent = `${count} / ${total}`;
  nextUnselectedButton.disabled = count === total;
  exportButton.disabled = count !== total;
}

function persistChoices() {
  const snapshot = { ...state.choices };
  setSaveStatus("선택 저장 중...");
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

function selectCandidate(radio) {
  const row = radio.closest("[data-testid='option-row']");
  state.choices[row.dataset.optionId] = radio.value;
  renderSelectionState();
  persistChoices();
}

function createCandidate(option, path) {
  const fragment = candidateTemplate.content.cloneNode(true);
  const candidate = fragment.querySelector("[data-testid='candidate']");
  const { tag, resultSide } = candidateMetadata(path);
  const audio = candidate.querySelector("audio");
  const playButton = candidate.querySelector("[data-action='play']");
  const radio = candidate.querySelector("input[type='radio']");
  const resultNumber = resultSide === "left" ? "1" : "2";

  candidate.dataset.audioPath = path;
  candidate.dataset.tagId = tag.id;
  candidate.dataset.side = resultSide;
  candidate.querySelector(".result-label").textContent = `결과 ${resultNumber}`;
  candidate.querySelector(".result-detail").textContent = resultSide === "left" ? "왼쪽 생성" : "오른쪽 생성";

  audio.src = path;
  audio.addEventListener("ended", () => {
    if (state.activeAudio === audio) pauseActiveAudio();
  });
  audio.addEventListener("error", () => {
    candidate.querySelector(".audio-status").textContent = "음원을 불러오지 못했습니다.";
    if (state.activeAudio === audio) pauseActiveAudio();
  });

  playButton.setAttribute("aria-label", `${option.text}, ${tag.text}, 결과 ${resultNumber} 듣기`);
  playButton.addEventListener("click", () => toggleAudio(playButton));

  radio.name = `choice:${option.id}`;
  radio.value = path;
  radio.setAttribute("aria-label", `${option.text}, ${tag.text}, 결과 ${resultNumber} 선택`);
  radio.addEventListener("change", () => selectCandidate(radio));
  return fragment;
}

function createOptionRow(option) {
  const fragment = optionTemplate.content.cloneNode(true);
  const row = fragment.querySelector("[data-testid='option-row']");
  const tagGrid = row.querySelector(".tag-grid");
  row.dataset.optionId = option.id;
  row.querySelector(".option-letter").textContent = option.option;
  row.querySelector("[data-testid='option-text']").textContent = option.text;

  for (const tag of state.manifest.manualTags) {
    const tagFragment = tagTemplate.content.cloneNode(true);
    const tagGroup = tagFragment.querySelector(".tag-group");
    const resultGrid = tagGroup.querySelector(".result-grid");
    const candidates = option.candidates.filter((path) => path.includes(`_${tag.id}_`));
    tagGroup.dataset.tagId = tag.id;
    tagGroup.querySelector(".tag-name").textContent = tag.text;
    candidates.forEach((path) => resultGrid.append(createCandidate(option, path)));
    tagGrid.append(tagFragment);
  }
  return fragment;
}

function renderOptions() {
  const fragment = document.createDocumentFragment();
  for (const option of state.manifest.options) fragment.append(createOptionRow(option));
  optionList.replaceChildren(fragment);
  optionList.setAttribute("aria-busy", "false");
  renderSelectionState();
}

function scrollToNextUnselected() {
  const row = [...optionList.querySelectorAll("[data-testid='option-row']")]
    .find((candidate) => !state.choices[candidate.dataset.optionId]);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "start" });
  row.querySelector("[data-action='play']").focus({ preventScroll: true });
}

async function exportSelections() {
  try {
    await state.saveQueue;
    const response = await fetch("api/selections", { cache: "no-store" });
    if (!response.ok) throw new Error(`내보내기 응답 ${response.status}`);
    const selectionDocument = await response.json();
    if (!selectionDocument.complete) throw new Error("네 문구를 모두 선택해 주세요.");

    const blob = new Blob([`${JSON.stringify(selectionDocument, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "haru-day1-q1-calm-mood-selections.json";
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus("선택 결과 내보내기 완료");
  } catch (error) {
    setSaveStatus(`내보내기 실패: ${error.message}`, true);
  }
}

nextUnselectedButton.addEventListener("click", scrollToNextUnselected);
exportButton.addEventListener("click", exportSelections);
window.addEventListener("beforeunload", pauseActiveAudio);

async function initialize() {
  try {
    const [manifestResponse, selectionsResponse] = await Promise.all([
      fetch("manifest.json", { cache: "no-store" }),
      fetch("api/selections", { cache: "no-store" }),
    ]);
    if (!manifestResponse.ok) throw new Error(`후보 목록 응답 ${manifestResponse.status}`);
    if (!selectionsResponse.ok) throw new Error(`선택 기록 응답 ${selectionsResponse.status}`);

    state.manifest = assertManifest(await manifestResponse.json());
    state.choices = choicesFromDocument(await selectionsResponse.json());
    renderOptions();
    setSaveStatus(selectedCount() > 0
      ? `${selectedCount()}개 기존 선택 복원됨`
      : "선택 결과는 이 컴퓨터에 바로 저장됩니다.");
  } catch (error) {
    optionList.setAttribute("aria-busy", "false");
    optionList.replaceChildren();
    loadError.hidden = false;
    loadError.textContent = `페이지를 준비하지 못했습니다: ${error.message}`;
  }
}

initialize();

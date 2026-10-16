import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspace = "C:/project/saerok-memory/.codex_tmp/voice-pilot-deck-headlines-20260807";
const sourcePptx = path.join(workspace, "template-starter.pptx");
const outputPptx = path.join(workspace, "edited.pptx");
const outputDir = path.join(workspace, "final-render");

const edits = [
  {
    id: "sh/sryl4zqx",
    from: "실증 전에,\n막히는 순간부터 측정했다",
    to: "실증 전 사용 흐름\n계측 설계",
  },
  {
    id: "sh/fu94fe98",
    from: "50~70대 현장 파일럿을 앞두고\n참여·이탈·재시도·STT 흐름을 먼저 연결했습니다.",
    to: "50~70대 현장 파일럿을 위한\n참여·이탈·재시도·STT 흐름 연결",
  },
  {
    id: "sh/w3i1sfa9",
    from: "샘플 흐름에서 이탈은 말하기 구간에 집중됐다",
    to: "샘플 흐름의 말하기 구간 이탈 집중",
  },
  {
    id: "sh/r65knqtk",
    from: "실제 파일럿에서 먼저 원인 코드를 심어야 할 위치가 선명해졌습니다.",
    to: "실제 파일럿 우선 계측 지점과 원인 코드 설계",
  },
  {
    id: "sh/pcjqtg36",
    from: "사용자가 맞춰 말하는 대신, 제품이 사용자를 돕는다",
    to: "사용자 발화 부담을 낮추는 음성 경험",
  },
  {
    id: "sh/m5cra54z",
    from: "말하기 부담과 입력 불확실성을 함께 줄이는 세 가지 개입입니다.",
    to: "말하기 부담과 입력 불확실성을 줄이는 세 가지 개입",
  },
  {
    id: "sh/sna103ap",
    from: "샘플 A/B로 실제 파일럿의 판정 기준을 정했다",
    to: "실제 파일럿을 위한 샘플 A/B 판정 기준",
  },
  {
    id: "sh/3ihk3et8",
    from: "사전 설정한 패턴입니다. 측정된 제품 효과가 아닙니다.",
    to: "사전 설정 패턴 · 측정된 제품 효과 아님",
  },
  {
    id: "sh/032tgr6d",
    from: "이제 실제 50~70대 파일럿에서\n가정을 관찰로 바꾼다",
    to: "50~70대 실제 파일럿을 통한\n가정 검증",
  },
  {
    id: "sh/n6dcr65o",
    from: "‘효과’보다 먼저, 어디서 왜 멈추는지 검증합니다.",
    to: "효과 주장보다 우선하는 이탈 지점·원인 확인",
  },
];

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(sourcePptx),
  );

  for (const edit of edits) {
    const target = presentation.resolve(edit.id);
    target.text = edit.to;
  }

  const snapshot = await presentation.inspect({
    kind: "slide,textbox,notes,layout",
    include: "id,slide,name,title,text,textPreview,textChars,textLines,bbox,bboxUnit,isPlaceholder,placeholders",
    maxChars: 100000,
  });
  await fs.writeFile(path.join(outputDir, "inspect.ndjson"), snapshot.ndjson);

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(
      path.join(outputDir, `${stem}.png`),
      await presentation.export({ slide, format: "png", scale: 2 }),
    );
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(outputDir, `${stem}.layout.json`), await layout.text());
  }

  await writeBlob(
    path.join(outputDir, "montage.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

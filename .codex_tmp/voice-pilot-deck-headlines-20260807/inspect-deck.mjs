import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspace = "C:/project/saerok-memory/.codex_tmp/voice-pilot-deck-headlines-20260807";
const sourcePptx = path.join(workspace, "source.pptx");
const outputDir = path.join(workspace, "manual-inspect");

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(sourcePptx),
  );

  const snapshot = await presentation.inspect({
    kind: "deck,slide,textbox,shape,image,chart,table,notes,layout",
    include: "id,slide,name,title,text,textPreview,textChars,textLines,bbox,bboxUnit,isPlaceholder,alt,placeholders",
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

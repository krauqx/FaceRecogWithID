import { ImageBlurProcessor } from "./ImageBlurProcessor.js";
import { ImageLightingProcessor } from "./ImageLightingProcessor.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { applySharpen } from "./ImageSharpen.js";
import { applyPerspectiveTilt } from "./ImagePerspectiveTilt.js";
import { applyLowBudgetCamera } from "./ImagePixelate.js";

export async function generateStudentVariants(
  inputPath,
  outputRoot = "./uploads/processed"
) {
  const processor = new ImageBlurProcessor();
  const lightingProcessor = new ImageLightingProcessor();

  const baseName = path.parse(inputPath).name;
  const outputDir = path.join(outputRoot, baseName);

  await mkdir(outputDir, { recursive: true });

  const generatedPaths = [];

  const save = async (filename, data) => {
    const out = path.join(outputDir, filename);
    await writeFile(out, data);
    generatedPaths.push(out);
  };

  console.log("start blur");
  for (let i = 1; i <= 5; i++) {
    const blurredImageBuffer = await processor.gaussianBlur(inputPath, 1.1 * i);
    await save(`${baseName}_blurred${i}.jpg`, blurredImageBuffer);
  }
  console.log("done blur");

  console.log("start lighting");
  for (let i = 1; i <= 10; i++) {
    const lit = await lightingProcessor.applyLighting(inputPath, i);
    await save(`${baseName}_lighting${i}.jpg`, lit);
  }
  console.log("done lighting");

  console.log("start sharpen");
  for (let i = 1; i <= 5; i++) {
    const blurredImageBuffer = await processor.gaussianBlur(inputPath, 1);
    const sharpened = await applySharpen(blurredImageBuffer, "medium");
    await save(`${baseName}_sharpened${i}.jpg`, sharpened);
  }
  console.log("done sharpen");

  // console.log("start tilt");
  // for (let i = 1; i <= 5; i++) {
  //   const blurredImageBuffer = await processor.gaussianBlur(inputPath, 1);

  //   const finaloutputleft = await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "left");
  //   await save(`${baseName}_lefttilt${i}.jpg`, finaloutputleft);

  //   const finaloutputright = await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "right");
  //   await save(`${baseName}_righttilt${i}.jpg`, finaloutputright);

  //   const finaloutputup = await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "up");
  //   await save(`${baseName}_uptilt${i}.jpg`, finaloutputup);

  //   const finaloutputdown = await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "down");
  //   await save(`${baseName}_downtilt${i}.jpg`, finaloutputdown);
  // }
  // console.log("done tilt");

  console.log("start pixelate");
  for (let i = 1; i <= 20; i++) {
    const pixelated = await applyLowBudgetCamera(inputPath, {
      scale: 0.012 * i,
      blurSigma: 0.4,
      jpegQuality: 35,
      sharpenSigma: 0.8,
    });

    await save(`${baseName}_pixelated${i}.jpg`, pixelated);
  }
  console.log("done pixelate");

  // try {
  // for (let i = 1; i <= 5; i++) {
  //   const blurredImageBuffer = await processor.gaussianBlur(inputPath, 1);

  //   await save(`${baseName}_lefttilt${i}.jpg`,
  //     await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "left"));

  //   await save(`${baseName}_righttilt${i}.jpg`,
  //     await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "right"));

  //   await save(`${baseName}_uptilt${i}.jpg`,
  //     await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "up"));

  //   await save(`${baseName}_downtilt${i}.jpg`,
  //     await applyPerspectiveTilt(blurredImageBuffer, 5 * i, "down"));
  //   }
  // } 
  // catch (err) {
  //   console.error("tilt failed:", err);
  // }

  return generatedPaths;
}
import sharp from "sharp";

export async function applyLowBudgetCamera(input, options = {}) {
  const {
    scale = 0.12,
    blurSigma = 0.8,
    jpegQuality = 35,
    sharpenSigma = 0.8,
  } = options;

  const meta = await sharp(input).metadata();

  if (!meta.width || !meta.height) {
    throw new Error("Could not read image dimensions.");
  }

  const width = meta.width;
  const height = meta.height;

  const downW = Math.max(1, Math.round(width * scale));
  const downH = Math.max(1, Math.round(height * scale));

  const lowRes = await sharp(input)
    .resize(downW, downH, { fit: "fill" })
    .toBuffer();

  let pipeline = sharp(lowRes).resize(width, height, {
    fit: "fill",
    kernel: "nearest",
  });

  if (blurSigma > 0) {
    pipeline = pipeline.blur(blurSigma);
  }

  if (sharpenSigma > 0) {
    pipeline = pipeline.sharpen({ sigma: sharpenSigma });
  }

  return await pipeline
    .jpeg({
      quality: jpegQuality,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
}
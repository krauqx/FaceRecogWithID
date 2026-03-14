import sharp from "sharp";

const sharpenMap = {
  low: {
    sigma: 1.0,
    m1: 0.8,
    m2: 1.2,
    x1: 2,
    y2: 10,
    y3: 20,
  },
  medium: {
    sigma: 1.5,
    m1: 1.0,
    m2: 1.8,
    x1: 2,
    y2: 10,
    y3: 20,
  },
  high: {
    sigma: 2.0,
    m1: 1.2,
    m2: 2.5,
    x1: 2,
    y2: 10,
    y3: 20,
  },
};

export async function applySharpen(input, level = "medium") {
  return await sharp(input)
    .sharpen(sharpenMap[level])
    .toBuffer();
}
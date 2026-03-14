import sharp from "sharp";

export class ImageLightingProcessor {
  async applyLighting(input, level) {
    if (!Number.isInteger(level) || level < 1 || level > 10) {
      throw new RangeError("level must be an integer from 1 to 5");
    }

    const brightnessMap = {
      1: 0.1,
      2: 0.2,
      3: 0.3,
      4: 0.4,
      5: 0.5,
      6: 0.6,
      7: 0.7,
      8: 0.8,
      9: 0.9,
      10: 1.0,
    };

    return await sharp(input)
      .modulate({ brightness: brightnessMap[level] })
      .toBuffer();
  }
}
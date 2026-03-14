import sharp from "sharp";

export class ImageBlurProcessor {
  async gaussianBlur(input, sigma) {
    return await sharp(input)
      .blur(sigma)
      .jpeg()
      .toBuffer();
  }
}
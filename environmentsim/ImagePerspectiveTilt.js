import sharp from "sharp";

function clampAngle(angleDegrees) {
  return Math.max(0, Math.min(20, Number(angleDegrees) || 0));
}

function angleToShear(angleDegrees) {
  const radians = (clampAngle(angleDegrees) * Math.PI) / 180;
  return Math.tan(radians) * 0.35;
}

export async function applyPerspectiveTilt(
  input,
  angleDegrees = 10,
  direction = "right"
) {
  const shear = angleToShear(angleDegrees);

  let matrix;
  switch (direction) {
    case "left":
      matrix = [[1, -shear], [0, 1]];
      break;
    case "right":
      matrix = [[1, shear], [0, 1]];
      break;
    case "up":
      matrix = [[1, 0], [-shear, 1]];
      break;
    case "down":
      matrix = [[1, 0], [shear, 1]];
      break;
    default:
      throw new Error(`Invalid direction: ${direction}`);
  }

  return await sharp(input)
    .affine(matrix, {
      background: { r: 0, g: 0, b: 0 },
      interpolator: sharp.interpolators.bilinear,
    })
    .jpeg({ quality: 70, chromaSubsampling: "4:2:0" })
    .toBuffer();
}
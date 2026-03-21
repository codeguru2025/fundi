import sharp from 'sharp';
import fs from 'fs';

const inputPath = 'attached_assets/Signature_1770743804753.jpeg';
const outputPath = 'server/assets/signature-clean.png';

fs.mkdirSync('server/assets', { recursive: true });

const image = sharp(inputPath);
const { width, height } = await image.metadata();

const { data, info } = await image
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = new Uint8Array(info.width * info.height * 4);

for (let i = 0; i < info.width * info.height; i++) {
  const r = data[i * 3];
  const g = data[i * 3 + 1];
  const b = data[i * 3 + 2];
  
  const brightness = (r + g + b) / 3;
  const isInk = brightness < 140 && b > r * 0.7;
  
  if (isInk) {
    const inkIntensity = Math.max(0, Math.min(255, 255 - brightness));
    pixels[i * 4] = 25;
    pixels[i * 4 + 1] = 25;
    pixels[i * 4 + 2] = 80;
    pixels[i * 4 + 3] = Math.min(255, inkIntensity * 2.5);
  } else {
    pixels[i * 4] = 0;
    pixels[i * 4 + 1] = 0;
    pixels[i * 4 + 2] = 0;
    pixels[i * 4 + 3] = 0;
  }
}

await sharp(Buffer.from(pixels), {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  }
})
  .trim()
  .resize(400, null, { fit: 'inside' })
  .png()
  .toFile(outputPath);

const base64 = fs.readFileSync(outputPath).toString('base64');
fs.writeFileSync('server/assets/signature-base64.txt', base64);

console.log(`Signature cleaned and saved to ${outputPath}`);
console.log(`Base64 saved to server/assets/signature-base64.txt`);
console.log(`Base64 length: ${base64.length}`);

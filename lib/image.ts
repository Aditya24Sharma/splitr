import sharp from 'sharp'
// heic-convert is CommonJS; default export is the `one` converter function
// Signature: ({ buffer, format, quality }) => Promise<Buffer>
// format must be uppercase: 'JPEG' or 'PNG'
import heicConvert from 'heic-convert'

export async function normalizeImage(buffer: Buffer, mime: string): Promise<Buffer> {
  let input = buffer
  if (mime === 'image/heic' || mime === 'image/heif') {
    input = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.9 }))
  }
  return sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
}

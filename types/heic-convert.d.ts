declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer
    format: 'JPEG' | 'PNG'
    quality?: number
  }
  function heicConvert(opts: ConvertOptions): Promise<Buffer>
  export = heicConvert
}

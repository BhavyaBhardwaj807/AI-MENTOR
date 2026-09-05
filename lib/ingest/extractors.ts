/**
 * lib/ingest/extractors.ts
 *
 * Document text extraction.
 */

const pdfParse = require("pdf-parse");

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || "";
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdfText(buffer);
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported MIME type for extraction: ${mimeType}`);
  }
}

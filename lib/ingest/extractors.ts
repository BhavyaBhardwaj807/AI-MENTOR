/**
 * lib/ingest/extractors.ts
 *
 * Document text extraction for Advanced RAG.
 */

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parseOffice } from "officeparser";
import Tesseract from "tesseract.js";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const data = await parser.getText();
    return data.text || "";
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

export async function extractPptxText(buffer: Buffer): Promise<string> {
  const ast = await parseOffice(buffer, { fileType: "pptx" });
  const { value } = await ast.to("text", {
    includeImages: false,
    textConfig: { preserveLayout: false, renderNotes: false },
  });
  return value || "";
}

export async function extractImageText(buffer: Buffer): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(buffer, "eng");
  return text || "";
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdfText(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocxText(buffer);
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return extractPptxText(buffer);
    case "image/png":
    case "image/jpeg":
    case "image/webp":
      return extractImageText(buffer);
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported MIME type for extraction: ${mimeType}`);
  }
}

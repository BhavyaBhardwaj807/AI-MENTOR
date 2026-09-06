import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courseMaterials } from "@/lib/db/schema";
import { storage } from "@/lib/storage";
import { embedQueue } from "@/lib/queue";
import { INGESTION } from "@/lib/brain/config";
import { requireClassOwner } from "@/lib/auth/guards";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const classId = formData.get("classId") as string | null;

    if (!file || !classId) {
      return NextResponse.json(
        { error: "Missing file or classId" },
        { status: 400 },
      );
    }

    const access = await requireClassOwner(classId);
    if (!access.ok) return access.response;

    if (file.size > INGESTION.maxFileSizeBytes) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${INGESTION.maxFileSizeBytes} bytes` },
        { status: 400 },
      );
    }

    if (!INGESTION.allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported MIME type: ${file.type}` },
        { status: 400 },
      );
    }

    // 2. Read file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Save via storage adapter
    const { storagePath, sizeBytes } = await storage.save(file.name, buffer, file.type);

    // 4. Create DB record
    const [material] = await db
      .insert(courseMaterials)
      .values({
        classId,
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes,
        embedStatus: "pending",
      })
      .returning();

    // 5. Enqueue background job
    await embedQueue.add(
      "embed-documents",
      { materialId: material.id },
      { jobId: material.id } // Prevent duplicates
    );

    return NextResponse.json({ success: true, material }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

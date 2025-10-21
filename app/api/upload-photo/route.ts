import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const taskId = formData.get("taskId") as string

    if (!file || !taskId) {
      return NextResponse.json({ error: "Missing file or taskId" }, { status: 400 })
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === "task-photos")

    if (!bucketExists) {
      // Create bucket with public access
      await supabase.storage.createBucket("task-photos", {
        public: true,
        fileSizeLimit: 1024 * 1024, // 1MB
      })
    }

    // Generate filename
    const timestamp = Date.now()
    const filename = `${taskId}_${timestamp}.jpg`

    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: "image/jpeg" })

    // Upload file using service role (bypasses RLS)
    const { data, error } = await supabase.storage.from("task-photos").upload(filename, blob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      console.error("Supabase upload error:", error)
      return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("task-photos").getPublicUrl(data.path)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}

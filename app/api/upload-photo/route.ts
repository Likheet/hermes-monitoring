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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Ensure bucket exists
    const bucketName = "task-photos"
    const maxFileSizeBytes = 10 * 1024 * 1024 // 10MB

    const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets()
    if (bucketListError) {
      console.error("Supabase list bucket error:", bucketListError)
      return NextResponse.json({ error: "Unable to access storage bucket" }, { status: 500 })
    }

    const existingBucket = buckets?.find((b) => b.name === bucketName)

    if (!existingBucket) {
      await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: maxFileSizeBytes,
      })
    } else if (!existingBucket.public || (existingBucket.file_size_limit ?? 0) < maxFileSizeBytes) {
      await supabase.storage.updateBucket(bucketName, {
        public: true,
        fileSizeLimit: maxFileSizeBytes,
      })
    }

    // Generate filename
    const timestamp = Date.now()
    const filename = `${taskId}_${timestamp}.jpg`

    const { data, error } = await supabase.storage.from(bucketName).upload(filename, file, {
      contentType: file.type || "image/jpeg",
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

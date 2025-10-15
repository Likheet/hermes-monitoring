export async function uploadTaskPhoto(taskId: string, file: Blob): Promise<string> {
  const formData = new FormData()
  formData.append("file", file, "photo.jpg")
  formData.append("taskId", taskId)

  const response = await fetch("/api/upload-photo", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Upload failed")
  }

  const { url } = await response.json()
  return url
}

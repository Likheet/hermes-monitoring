-- Create storage bucket for task photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task photos
CREATE POLICY "Authenticated users can upload task photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-photos' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Anyone can view task photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-photos');

CREATE POLICY "Users can update own task photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'task-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own task photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

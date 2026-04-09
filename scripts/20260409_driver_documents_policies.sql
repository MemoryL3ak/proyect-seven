-- Add storage policies for driver-documents bucket (same pattern as provider-documents)
CREATE POLICY "driver_documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'driver-documents');

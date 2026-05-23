import type { Enums } from "../supabase.types";

export type DocumentKind = Enums<"document_kind">;

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  uploadedAt: string;
  source?: "local" | "remote";
  storageBucket?: string;
  storagePath?: string;
}

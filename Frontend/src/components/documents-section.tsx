import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  getDocuments, 
  uploadDocument, 
  deleteDocument, 
  getDocumentDownloadUrl 
} from "@/lib/documents-service";
import type { DocumentMetadata } from "@/lib/types";
import { toast } from "sonner";
import { AppError } from "@/lib/types";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Loader2, 
  File as FileIcon 
} from "lucide-react";

interface DocumentsSectionProps {
  applicationId: string;
}

export function DocumentsSection({ applicationId }: DocumentsSectionProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    if (!user) return;
    try {
      const data = await getDocuments(user.id, applicationId);
      setDocuments(data);
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast.error("Failed to load attached documents.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, [user, applicationId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Create a nice display name (e.g. "Resume.pdf" -> "Resume")
      const displayName = file.name.split('.').slice(0, -1).join('.');
      
      const newDoc = await uploadDocument(user.id, file, applicationId, displayName);
      setDocuments(prev => [newDoc, ...prev]);
      toast.success("Document uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      if (error instanceof AppError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to upload document.");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!user) return;
    const confirm = window.confirm("Are you sure you want to delete this document permanently?");
    if (!confirm) return;

    try {
      await deleteDocument(user.id, documentId);
      setDocuments(prev => prev.filter(d => d.id !== documentId));
      toast.success("Document deleted.");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document.");
    }
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    toast.info("Mockup Mode: Since Firebase Storage requires a credit card on the Blaze plan, the actual PDF wasn't saved to Google servers. This button is just for show!");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          Documents
        </h3>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload
        </button>
        <input 
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
          <FileIcon size={24} className="mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No documents attached.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Upload resumes or cover letters here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                  <FileText size={16} />
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold truncate text-foreground">{doc.displayName || doc.fileName}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleDownload(doc.id, doc.fileName)}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

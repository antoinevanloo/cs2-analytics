"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { demosApi } from "@/lib/api";
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoUploaderProps {
  onUploadComplete: () => void;
  onCancel: () => void;
}

type UploadStatus = "idle" | "uploading" | "parsing" | "complete" | "error";

interface FileUpload {
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  demoId?: string;
}

export function DemoUploader({ onUploadComplete, onCancel }: DemoUploaderProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads = acceptedFiles
      .filter((file) => file.name.endsWith(".dem"))
      .map((file) => ({
        file,
        status: "idle" as UploadStatus,
        progress: 0,
      }));

    setUploads((prev) => [...prev, ...newUploads]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/octet-stream": [".dem"],
    },
    multiple: true,
  });

  const uploadFile = async (upload: FileUpload, index: number) => {
    setUploads((prev) =>
      prev.map((u, i) =>
        i === index ? { ...u, status: "uploading", progress: 0 } : u
      )
    );

    try {
      // Simulate progress (real implementation would use XMLHttpRequest for progress)
      const progressInterval = setInterval(() => {
        setUploads((prev) =>
          prev.map((u, i) =>
            i === index && u.progress < 90
              ? { ...u, progress: u.progress + 10 }
              : u
          )
        );
      }, 200);

      const result = await demosApi.upload(upload.file);

      clearInterval(progressInterval);

      setUploads((prev) =>
        prev.map((u, i) =>
          i === index
            ? { ...u, status: "parsing", progress: 100, demoId: result.id }
            : u
        )
      );

      // Start parsing
      await demosApi.parse(result.id, { extractTicks: false });

      setUploads((prev) =>
        prev.map((u, i) =>
          i === index ? { ...u, status: "complete" } : u
        )
      );
    } catch (error) {
      setUploads((prev) =>
        prev.map((u, i) =>
          i === index
            ? {
                ...u,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : u
        )
      );
    }
  };

  const uploadAll = async () => {
    const pendingUploads = uploads.filter((u) => u.status === "idle");
    for (let i = 0; i < uploads.length; i++) {
      if (uploads[i].status === "idle") {
        await uploadFile(uploads[i], i);
      }
    }
    onUploadComplete();
  };

  const removeFile = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  };

  const allComplete = uploads.length > 0 && uploads.every((u) => u.status === "complete");
  const hasErrors = uploads.some((u) => u.status === "error");
  const isUploading = uploads.some((u) => u.status === "uploading" || u.status === "parsing");

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        {isDragActive ? (
          <p>Drop the demo files here...</p>
        ) : (
          <div>
            <p className="font-medium">Drag & drop demo files here</p>
            <p className="text-sm text-muted-foreground">
              or click to select files (.dem)
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-muted rounded-md"
            >
              <File className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="h-1 mt-1" />
                )}
                {upload.status === "parsing" && (
                  <p className="text-xs text-primary mt-1">Parsing...</p>
                )}
                {upload.error && (
                  <p className="text-xs text-destructive mt-1">{upload.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {upload.status === "complete" && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                {upload.status === "idle" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          onClick={uploadAll}
          disabled={uploads.length === 0 || isUploading || allComplete}
        >
          {isUploading
            ? "Uploading..."
            : allComplete
              ? "Complete"
              : `Upload ${uploads.filter((u) => u.status === "idle").length} files`}
        </Button>
      </div>
    </div>
  );
}

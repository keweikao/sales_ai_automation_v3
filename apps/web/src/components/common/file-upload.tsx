import {
  AlertCircle,
  CheckCircle2,
  File,
  FileAudio,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return "0 Bytes";
  }
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

type FileStatus = "pending" | "uploading" | "success" | "error";

function getFileIconBgClass(status: FileStatus): string {
  switch (status) {
    case "error":
      return "bg-red-100 dark:bg-red-900/30";
    case "success":
      return "bg-green-100 dark:bg-green-900/30";
    default:
      return "bg-muted";
  }
}

function FileStatusIcon({
  status,
  isAudio,
}: {
  status: FileStatus;
  isAudio: boolean;
}) {
  if (status === "error") {
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  }
  if (status === "success") {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  if (isAudio) {
    return <FileAudio className="h-5 w-5 text-muted-foreground" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export function FileUpload({
  accept = "audio/*",
  maxSize = 100 * 1024 * 1024, // 100MB default
  multiple = false,
  onUpload,
  className,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (maxSize && file.size > maxSize) {
        return `檔案大小超過限制 (${formatFileSize(maxSize)})`;
      }

      if (accept && accept !== "*") {
        const acceptedTypes = accept.split(",").map((t) => t.trim());
        const fileType = file.type;
        const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;

        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return type.toLowerCase() === fileExtension;
          }
          if (type.endsWith("/*")) {
            return fileType.startsWith(type.replace("/*", "/"));
          }
          return type === fileType;
        });

        if (!isAccepted) {
          return "不支援的檔案類型";
        }
      }

      return null;
    },
    [accept, maxSize]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles: UploadedFile[] = [];
      const filesToUpload: File[] = [];

      for (const file of Array.from(fileList)) {
        const error = validateFile(file);
        if (error) {
          newFiles.push({
            file,
            status: "error",
            progress: 0,
            error,
          });
        } else {
          newFiles.push({
            file,
            status: "pending",
            progress: 0,
          });
          filesToUpload.push(file);
        }
      }

      setFiles((prev) => (multiple ? [...prev, ...newFiles] : newFiles));

      if (filesToUpload.length > 0) {
        // Simulate upload progress
        for (const uploadFile of newFiles.filter(
          (f) => f.status === "pending"
        )) {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === uploadFile.file ? { ...f, status: "uploading" } : f
            )
          );

          // Simulate progress
          for (let progress = 0; progress <= 100; progress += 10) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            setFiles((prev) =>
              prev.map((f) =>
                f.file === uploadFile.file ? { ...f, progress } : f
              )
            );
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.file === uploadFile.file
                ? { ...f, status: "success", progress: 100 }
                : f
            )
          );
        }

        // Call the onUpload callback
        try {
          await onUpload(filesToUpload);
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              filesToUpload.includes(f.file)
                ? { ...f, status: "error", error: "上傳失敗" }
                : f
            )
          );
        }
      }
    },
    [multiple, onUpload, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) {
        return;
      }

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles);
      }
      // Reset input
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeFile = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== fileToRemove));
  }, []);

  const isAudioFile = accept?.includes("audio");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-10">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}
          >
            {isAudioFile ? (
              <FileAudio
                className={cn(
                  "h-7 w-7",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
            ) : (
              <Upload
                className={cn(
                  "h-7 w-7",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
            )}
          </div>

          <div className="mt-4 text-center">
            <p className="font-medium text-sm">
              {isDragging ? "放開以上傳檔案" : "拖放檔案到這裡"}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              或點擊下方按鈕選擇檔案
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              最大檔案大小: {formatFileSize(maxSize)}
            </p>
          </div>

          <label
            className={cn(
              "mt-4 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-none border border-input bg-background px-2.5 text-xs hover:bg-muted",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <input
              accept={accept}
              className="sr-only"
              disabled={disabled}
              multiple={multiple}
              onChange={handleInputChange}
              type="file"
            />
            <Upload className="h-4 w-4" />
            選擇檔案
          </label>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uploadedFile, index) => (
            <Card className="p-3" key={`${uploadedFile.file.name}-${index}`}>
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                    getFileIconBgClass(uploadedFile.status)
                  )}
                >
                  <FileStatusIcon
                    isAudio={isAudioFile ?? false}
                    status={uploadedFile.status}
                  />
                </div>

                {/* File Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {uploadedFile.file.name}
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span>{formatFileSize(uploadedFile.file.size)}</span>
                    {uploadedFile.error && (
                      <span className="text-red-500">{uploadedFile.error}</span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {uploadedFile.status === "uploading" && (
                    <Progress
                      className="mt-2 h-1"
                      value={uploadedFile.progress}
                    />
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  aria-label="移除檔案"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => removeFile(uploadedFile.file)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

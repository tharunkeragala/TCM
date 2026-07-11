import { useState, useCallback, useRef } from "react";
import {
  FaCloudUploadAlt,
  FaFileAlt,
  FaTimes,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import API from "../../services/api";

interface UploadItem {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const MAX_SIZE_MB = 25;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.csv,.zip";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function DocumentUploader({
  projectId,
  onUploaded,
}: {
  projectId: number;
  onUploaded: () => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | File[]) => {
    const valid: UploadItem[] = Array.from(fileList).map((file) =>
      file.size > MAX_SIZE_MB * 1024 * 1024
        ? { file, progress: 0, status: "error", error: `Exceeds ${MAX_SIZE_MB}MB limit` }
        : { file, progress: 0, status: "pending" },
    );
    setItems((prev) => [...prev, ...valid]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, []);

  const handleDrag = (e: React.DragEvent, active: boolean) => {
    e.preventDefault();
    setDragActive(active);
  };

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const uploadAll = async () => {
    const pending = items.filter((it) => it.status === "pending");
    if (!pending.length) return;

    const formData = new FormData();
    pending.forEach((it) => formData.append("documents", it.file));

    setItems((prev) => prev.map((it) => (it.status === "pending" ? { ...it, status: "uploading" } : it)));

    try {
      await API.post(`/api/projects/${projectId}/documents`, formData, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          setItems((prev) =>
            prev.map((it) => (it.status === "uploading" ? { ...it, progress: percent } : it)),
          );
        },
      });
      setItems((prev) =>
        prev.map((it) => (it.status === "uploading" ? { ...it, status: "done", progress: 100 } : it)),
      );
      onUploaded();
      setTimeout(() => setItems((prev) => prev.filter((it) => it.status !== "done")), 1500);
    } catch (err: any) {
      setItems((prev) =>
        prev.map((it) =>
          it.status === "uploading"
            ? { ...it, status: "error", error: err.response?.data?.message || "Upload failed" }
            : it,
        ),
      );
    }
  };

  const hasPending = items.some((it) => it.status === "pending");

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => handleDrag(e, true)}
        onDragEnter={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
      >
        <FaCloudUploadAlt className="w-8 h-8 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          PDF, Word, Excel, images, txt, csv, zip up to {MAX_SIZE_MB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div
              key={`${it.file.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2"
            >
              <FaFileAlt className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                    {it.file.name}
                  </p>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatBytes(it.file.size)}
                  </span>
                </div>
                {it.status === "uploading" && (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-150"
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>
                )}
                {it.status === "error" && <p className="text-[10px] text-red-500 mt-0.5">{it.error}</p>}
              </div>
              {it.status === "done" ? (
                <FaCheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : it.status === "error" ? (
                <FaExclamationCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              ) : (
                <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <FaTimes className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hasPending && (
        <button
          onClick={uploadAll}
          className="mt-3 w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-sm font-medium text-white transition"
        >
          Upload {items.filter((it) => it.status === "pending").length} file(s)
        </button>
      )}
    </div>
  );
}
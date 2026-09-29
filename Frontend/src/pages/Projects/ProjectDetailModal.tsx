import { useState, useEffect, useCallback } from "react";

import {
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileAlt,
  FaDownload,
  FaTrash,
  FaStickyNote,
} from "react-icons/fa";

import API from "../../services/api";

import DocumentUploader from "../../components/common/DocumentUploader";

import DOMPurify from "dompurify";

import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../context/ToastProvider";

interface ProjectDoc {
  id: number;

  original_name: string;

  file_size: number;

  mime_type: string;

  uploaded_by_name?: string;

  created_at: string;
}

interface ProjectNote {
  id: number;

  project_id: number;

  note_text: string;

  created_by?: number;

  created_by_name?: string;

  created_at: string;
}

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function fileIcon(mime: string) {
  if (mime?.includes("pdf")) return <FaFilePdf className="text-red-500" />;

  if (mime?.includes("word")) return <FaFileWord className="text-blue-500" />;

  if (mime?.includes("sheet") || mime?.includes("excel"))
    return <FaFileExcel className="text-green-600" />;

  if (mime?.startsWith("image/"))
    return <FaFileImage className="text-purple-500" />;

  if (mime?.includes("zip"))
    return <FaFileArchive className="text-amber-500" />;

  return <FaFileAlt className="text-gray-400" />;
}

export default function ProjectDetailModal({
  project,

  onClose,

  onEdit,
}: {
  project: any;

  onClose: () => void;

  onEdit: () => void;
}) {
  const { can } = usePermissions();

  const canDeleteProjectContent = can("/projects", "can_delete");
  const toast = useToast();

  const [tab, setTab] = useState<"overview" | "documents" | "notes">(
    "overview",
  );

  const [docs, setDocs] = useState<ProjectDoc[]>([]);

  const [loadingDocs, setLoadingDocs] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [notes, setNotes] = useState<ProjectNote[]>([]);

  const [loadingNotes, setLoadingNotes] = useState(false);

  const [newNote, setNewNote] = useState("");

  const [addingNote, setAddingNote] = useState(false);

  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true);

    try {
      const res = await API.get(`/api/projects/${project.id}/documents`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      setDocs(res.data.success ? res.data.data || [] : []);
    } catch (error: any) {
      console.error("Failed to load project documents:", error);

      setDocs([]);

      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to load project documents.",
      );
    } finally {
      setLoadingDocs(false);
    }
  }, [project.id, toast]);

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);

    try {
      const res = await API.get(`/api/projects/${project.id}/notes`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      setNotes(res.data.success ? res.data.data || [] : []);
    } catch (error: any) {
      console.error("Failed to load project notes:", error);

      setNotes([]);

      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to load project notes.",
      );
    } finally {
      setLoadingNotes(false);
    }
  }, [project.id, toast]);

  useEffect(() => {
    fetchDocs();

    fetchNotes();
  }, [fetchDocs, fetchNotes]);

  const handleAddNote = async () => {
    const text = newNote.trim();

    if (!text) {
      toast.warning("Please enter a note before adding.");

      return;
    }

    setAddingNote(true);

    try {
      const res = await API.post(
        `/api/projects/${project.id}/notes`,

        { note_text: text },

        { headers: { Authorization: `Bearer ${getToken()}` } },
      );

      if (res.data.success) {
        setNotes((prev) => [res.data.data, ...prev]);

        setNewNote("");

        toast.success("Project note added successfully.");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to add project note.",
      );
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (note: ProjectNote) => {
    if (!canDeleteProjectContent) {
      toast.error(
        "Access denied. You do not have permission to delete project notes.",
      );

      return;
    }

    setDeletingNoteId(note.id);

    try {
      await API.delete(`/api/projects/notes/${note.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      setNotes((prev) => prev.filter((n) => n.id !== note.id));

      toast.success("Project note deleted successfully.");
    } catch (error: any) {
      toast.error(
        error?.response?.status === 403
          ? "Access denied. You do not have permission to delete project notes."
          : error?.response?.data?.message ||
              error?.response?.data?.error ||
              "Failed to delete project note.",
      );
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDownload = async (doc: ProjectDoc) => {
    try {
      const res = await API.get(`/api/projects/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },

        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));

      const link = document.createElement("a");

      link.href = url;

      link.download = doc.original_name;

      link.click();

      window.URL.revokeObjectURL(url);

      toast.success("Document downloaded successfully.");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to download document.",
      );
    }
  };

  const handleDelete = async (doc: ProjectDoc) => {
    if (!canDeleteProjectContent) {
      toast.error(
        "Access denied. You do not have permission to delete project documents.",
      );

      return;
    }

    setDeletingId(doc.id);

    try {
      await API.delete(`/api/projects/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      setDocs((prev) => prev.filter((d) => d.id !== doc.id));

      toast.success("Project document deleted successfully.");
    } catch (error: any) {
      toast.error(
        error?.response?.status === 403
          ? "Access denied. You do not have permission to delete project documents."
          : error?.response?.data?.message ||
              error?.response?.data?.error ||
              "Failed to delete project document.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="flex w-full max-w-2xl max-h-[84vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
          <div className="flex-shrink-0 px-6 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {project.project_name}
                </h2>

                <span
                  className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                    project.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {project.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-1 border-b border-gray-200 px-6 dark:border-gray-700">
            {(["overview", "documents", "notes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                {t === "overview"
                  ? "Overview"
                  : t === "documents"
                    ? `Documents (${docs.length})`
                    : `Notes (${notes.length})`}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-4">
            {tab === "overview" && (
              <div className="max-h-[56vh] space-y-4 overflow-y-auto pr-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Description
                  </p>

                  {project.description ? (
                    <div
                      className="

                    max-h-52 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700

                    dark:bg-gray-800 dark:text-gray-300

                    [&_p]:my-1.5

                    [&_p:first-child]:mt-0

                    [&_p:last-child]:mb-0

                    [&_strong]:font-semibold

                    [&_em]:italic

                    [&_ul]:my-2

                    [&_ul]:list-disc

                    [&_ul]:pl-5

                    [&_ol]:my-2

                    [&_ol]:list-decimal

                    [&_ol]:pl-5

                    [&_li]:my-0.5

                    [&_blockquote]:my-2

                    [&_blockquote]:border-l-4

                    [&_blockquote]:border-gray-300

                    [&_blockquote]:pl-3

                    [&_blockquote]:italic

                    [&_blockquote]:text-gray-500

                    dark:[&_blockquote]:border-gray-600

                    dark:[&_blockquote]:text-gray-400

                    [&_a]:font-medium

                    [&_a]:text-blue-600

                    [&_a]:underline

                    [&_a]:underline-offset-2

                    dark:[&_a]:text-blue-400

                    [&_h1]:my-2

                    [&_h1]:text-xl

                    [&_h1]:font-bold

                    [&_h2]:my-2

                    [&_h2]:text-lg

                    [&_h2]:font-semibold

                    [&_h3]:my-2

                    [&_h3]:text-base

                    [&_h3]:font-semibold

                  "
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(project.description),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    ["Project Manager", project.project_manager_name || "—"],

                    [
                      "Project Assignees",

                      Array.isArray(project.project_assignees) &&
                      project.project_assignees.length > 0
                        ? project.project_assignees

                            .map((user: any) => user.username)

                            .join(", ")
                        : "—",
                    ],

                    ["Created By", project.created_by_name],

                    [
                      "Created At",

                      project.created_at
                        ? new Date(project.created_at).toLocaleString()
                        : "—",
                    ],

                    ["Last Updated By", project.updated_by_name],

                    [
                      "Last Updated At",

                      project.updated_at
                        ? new Date(project.updated_at).toLocaleString()
                        : "—",
                    ],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {label}
                      </p>

                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {value || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={onEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Edit Project
                  </button>
                </div>
              </div>
            )}

            {tab === "documents" && (
              <div className="space-y-4">
                {/* Existing Documents */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Documents
                    </p>

                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {docs.length}{" "}
                      {docs.length === 1 ? "document" : "documents"}
                    </span>
                  </div>

                  <div className="max-h-[285px] overflow-y-auto pr-1">
                    {loadingDocs ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        Loading documents…
                      </p>
                    ) : docs.length === 0 ? (
                      <p className="py-4 text-center text-sm italic text-gray-400">
                        No documents uploaded yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="

                  flex min-h-[52px] items-center gap-3

                  rounded-lg border border-gray-200

                  px-3 py-2

                  dark:border-gray-700

                "
                          >
                            <span className="flex-shrink-0 text-lg">
                              {fileIcon(doc.mime_type)}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p
                                className="

                      truncate text-sm font-medium

                      text-gray-700 dark:text-gray-200

                    "
                                title={doc.original_name}
                              >
                                {doc.original_name}
                              </p>

                              <p className="text-[11px] text-gray-400">
                                {formatBytes(doc.file_size)} ·{" "}
                                {doc.uploaded_by_name || "Unknown"} ·{" "}
                                {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex flex-shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDownload(doc)}
                                className="

                      rounded-md p-1.5 text-blue-600

                      hover:bg-blue-100

                      dark:hover:bg-blue-900/30

                    "
                                title="Download"
                              >
                                <FaDownload className="h-3.5 w-3.5" />
                              </button>

                              {canDeleteProjectContent && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(doc)}
                                  disabled={deletingId === doc.id}
                                  className="

                      rounded-md p-1.5 text-red-500

                      hover:bg-red-100

                      disabled:opacity-50

                      dark:hover:bg-red-900/30

                    "
                                  title="Delete"
                                >
                                  <FaTrash className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Documents */}

                <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Upload Documents
                  </p>

                  <DocumentUploader
                    projectId={project.id}
                    onUploaded={fetchDocs}
                  />
                </div>
              </div>
            )}

            {tab === "notes" && (
              <div className="space-y-4">
                {/* Existing Notes */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Notes
                    </p>

                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {notes.length} {notes.length === 1 ? "note" : "notes"}
                    </span>
                  </div>

                  <div className="max-h-[285px] overflow-y-auto pr-1">
                    {loadingNotes ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        Loading notes…
                      </p>
                    ) : notes.length === 0 ? (
                      <p className="py-4 text-center text-sm italic text-gray-400">
                        No notes yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className="

                  flex min-h-[52px] items-start gap-3

                  rounded-lg border border-gray-200

                  px-3 py-2

                  dark:border-gray-700

                "
                          >
                            <FaStickyNote className="mt-1 flex-shrink-0 text-amber-400" />

                            <div className="min-w-0 flex-1">
                              <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">
                                {note.note_text}
                              </p>

                              <p className="mt-1 text-[11px] text-gray-400">
                                {note.created_by_name || "Unknown"} ·{" "}
                                {new Date(note.created_at).toLocaleString()}
                              </p>
                            </div>

                            {canDeleteProjectContent && (
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note)}
                                disabled={deletingNoteId === note.id}
                                className="

                    flex-shrink-0 rounded-md p-1.5

                    text-red-500

                    hover:bg-red-100

                    disabled:opacity-50

                    dark:hover:bg-red-900/30

                  "
                                title="Delete"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Note */}

                <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Add Note
                  </p>

                  <div className="flex gap-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();

                          handleAddNote();
                        }
                      }}
                      placeholder="Jot down a note… (Ctrl/Cmd + Enter to save)"
                      rows={2}
                      className="

            flex-1 resize-none rounded-lg

            border border-gray-200 bg-transparent

            px-3 py-2 text-sm text-gray-700

            focus:outline-none focus:ring-2 focus:ring-blue-500

            dark:border-gray-700 dark:text-gray-200

          "
                    />

                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={addingNote || !newNote.trim()}
                      className="

            self-end rounded-lg bg-blue-600

            px-4 py-2 text-sm font-medium text-white

            hover:bg-blue-700

            disabled:opacity-50

          "
                    >
                      {addingNote ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

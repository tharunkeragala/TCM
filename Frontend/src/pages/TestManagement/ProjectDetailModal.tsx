import { useState, useEffect, useCallback } from "react";
import {
  FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaFileArchive, FaFileAlt,
  FaDownload, FaTrash, FaStickyNote,
} from "react-icons/fa";
import API from "../../services/api";
import DocumentUploader from "../../components/common/DocumentUploader";

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

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function fileIcon(mime: string) {
  if (mime?.includes("pdf")) return <FaFilePdf className="text-red-500" />;
  if (mime?.includes("word")) return <FaFileWord className="text-blue-500" />;
  if (mime?.includes("sheet") || mime?.includes("excel")) return <FaFileExcel className="text-green-600" />;
  if (mime?.startsWith("image/")) return <FaFileImage className="text-purple-500" />;
  if (mime?.includes("zip")) return <FaFileArchive className="text-amber-500" />;
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
  const [tab, setTab] = useState<"overview" | "documents" | "notes">("overview");
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
      if (res.data.success) setDocs(res.data.data);
    } finally {
      setLoadingDocs(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await API.get(`/api/projects/${project.id}/notes`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setNotes(res.data.data);
    } finally {
      setLoadingNotes(false);
    }
  }, [project.id]);

  useEffect(() => {
    if (tab === "notes" && notes.length === 0) fetchNotes();
  }, [tab, notes.length, fetchNotes]);

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setAddingNote(true);
    try {
      const res = await API.post(
        `/api/projects/${project.id}/notes`,
        { note_text: text },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (res.data.success) {
        setNotes((prev) => [res.data.data, ...prev]);
        setNewNote("");
      }
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (note: ProjectNote) => {
    setDeletingNoteId(note.id);
    try {
      await API.delete(`/api/projects/notes/${note.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDownload = async (doc: ProjectDoc) => {
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
  };

  const handleDelete = async (doc: ProjectDoc) => {
    setDeletingId(doc.id);
    try {
      await API.delete(`/api/projects/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{project.project_name}</h2>
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">
            &times;
          </button>
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
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

        {tab === "overview" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{project.description || "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Created By", project.created_by_name],
                ["Created At", project.created_at ? new Date(project.created_at).toLocaleString() : "—"],
                ["Last Updated By", project.updated_by_name],
                ["Last Updated At", project.updated_at ? new Date(project.updated_at).toLocaleString() : "—"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{value || "—"}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={onEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
                Edit Project
              </button>
            </div>
          </div>
        )}

        {tab === "documents" && (
          <div>
            <DocumentUploader projectId={project.id} onUploaded={fetchDocs} />
            <div className="mt-4 space-y-2">
              {loadingDocs ? (
                <p className="text-sm text-gray-400 text-center py-4">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">No documents uploaded yet.</p>
              ) : (
                docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <span className="text-lg flex-shrink-0">{fileIcon(doc.mime_type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{doc.original_name}</p>
                      <p className="text-[11px] text-gray-400">
                        {formatBytes(doc.file_size)} · {doc.uploaded_by_name || "Unknown"} · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => handleDownload(doc)} className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="Download">
                      <FaDownload className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50"
                      title="Delete"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div>
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
                className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="self-end px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
              >
                {addingNote ? "Adding…" : "Add"}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {loadingNotes ? (
                <p className="text-sm text-gray-400 text-center py-4">Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                  >
                    <FaStickyNote className="text-amber-400 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                        {note.note_text}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {note.created_by_name || "Unknown"} ·{" "}
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note)}
                      disabled={deletingNoteId === note.id}
                      className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50"
                      title="Delete"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

import {
  FaBold,
  FaItalic,
  FaListUl,
  FaListOl,
  FaQuoteRight,
  FaUndo,
  FaRedo,
  FaLink,
  FaUnlink,
} from "react-icons/fa";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter description...",
  disabled = false,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,

      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,

        HTMLAttributes: {
          class:
            "text-brand-600 dark:text-brand-400 underline underline-offset-2",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],

    content: value || "",

    editable: !disabled,

    editorProps: {
      attributes: {
        class:
          "rich-text-editor-content " +
          "min-h-[140px] max-h-[300px] overflow-y-auto " +
          "px-4 py-3 " +
          "text-sm leading-relaxed " +
          "text-gray-900 dark:text-white " +
          "focus:outline-none",
      },
    },

    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  /* ---------------------------------------------------------------------- */
  /* Sync value coming from parent                                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!editor) {
      return;
    }

    const incomingValue = value || "";

    const currentValue = editor.getHTML();

    if (incomingValue !== currentValue) {
      editor.commands.setContent(incomingValue, {
        emitUpdate: false,
      });
    }
  }, [value, editor]);

  /* ---------------------------------------------------------------------- */
  /* Sync editable state                                                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Toolbar button styling                                                 */
  /* ---------------------------------------------------------------------- */

  const buttonClass = (active = false) =>
    [
      "flex h-8 w-8 items-center justify-center",
      "rounded-md text-xs",
      "transition-colors duration-150",

      active
        ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white",

      disabled ? "cursor-not-allowed opacity-40" : "",
    ].join(" ");

  /* ---------------------------------------------------------------------- */
  /* Add / edit hyperlink                                                   */
  /* ---------------------------------------------------------------------- */

  const handleLink = () => {
    if (disabled) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href || "";

    const url = window.prompt("Enter URL", previousUrl);

    if (url === null) {
      return;
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();

      return;
    }

    const normalizedUrl = /^(https?:\/\/|mailto:|tel:)/i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: normalizedUrl,
      })
      .run();
  };

  return (
    <>
      {/* ================================================================ */}
      {/* TipTap editor styles                                             */}
      {/* ================================================================ */}

      <style>
        {`
          /*
           * TipTap / ProseMirror
           *
           * Tailwind Preflight removes the browser's normal list markers.
           * These rules restore bullet and numbered list markers inside
           * the actual editing area.
           */

          .rich-text-editor-content {
            outline: none;
            word-break: break-word;
          }

          .rich-text-editor-content p {
            margin-top: 0.375rem;
            margin-bottom: 0.375rem;
          }

          .rich-text-editor-content p:first-child {
            margin-top: 0;
          }

          .rich-text-editor-content p:last-child {
            margin-bottom: 0;
          }

          /* ------------------------------------------------------------ */
          /* Bullet lists                                                 */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content ul {
            display: block !important;
            list-style-type: disc !important;
            list-style-position: outside !important;

            padding-left: 1.75rem !important;

            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
          }

          /* ------------------------------------------------------------ */
          /* Numbered lists                                               */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content ol {
            display: block !important;
            list-style-type: decimal !important;
            list-style-position: outside !important;

            padding-left: 1.75rem !important;

            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
          }

          /* ------------------------------------------------------------ */
          /* List items                                                   */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content li {
            display: list-item !important;

            margin-top: 0.25rem !important;
            margin-bottom: 0.25rem !important;

            padding-left: 0.125rem;
          }

          .rich-text-editor-content li > p {
            display: inline;
            margin: 0;
          }

          /*
           * TipTap can sometimes render nested paragraphs inside the
           * list item. Make sure they don't remove the marker alignment.
           */
          .rich-text-editor-content li p {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }

          /* ------------------------------------------------------------ */
          /* Nested bullet lists                                          */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content ul ul {
            list-style-type: circle !important;

            margin-top: 0.25rem !important;
            margin-bottom: 0.25rem !important;

            padding-left: 1.5rem !important;
          }

          .rich-text-editor-content ul ul ul {
            list-style-type: square !important;
          }

          /* ------------------------------------------------------------ */
          /* Nested numbered lists                                        */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content ol ol {
            list-style-type: lower-alpha !important;

            margin-top: 0.25rem !important;
            margin-bottom: 0.25rem !important;

            padding-left: 1.5rem !important;
          }

          .rich-text-editor-content ol ol ol {
            list-style-type: lower-roman !important;
          }

          /* ------------------------------------------------------------ */
          /* Mixed nested lists                                           */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content ul ol {
            list-style-type: decimal !important;
          }

          .rich-text-editor-content ol ul {
            list-style-type: disc !important;
          }

          /* ------------------------------------------------------------ */
          /* Blockquote                                                   */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content blockquote {
            margin-top: 0.5rem;
            margin-bottom: 0.5rem;

            padding-left: 0.75rem;

            border-left: 4px solid #d1d5db;

            color: #6b7280;

            font-style: italic;
          }

          .dark .rich-text-editor-content blockquote {
            border-left-color: #4b5563;
            color: #9ca3af;
          }

          /* ------------------------------------------------------------ */
          /* Headings                                                     */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content h1 {
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;

            font-size: 1.25rem;
            line-height: 1.75rem;

            font-weight: 700;
          }

          .rich-text-editor-content h2 {
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;

            font-size: 1.125rem;
            line-height: 1.75rem;

            font-weight: 600;
          }

          .rich-text-editor-content h3 {
            margin-top: 0.5rem;
            margin-bottom: 0.375rem;

            font-size: 1rem;
            line-height: 1.5rem;

            font-weight: 600;
          }

          /* ------------------------------------------------------------ */
          /* Links                                                        */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content a {
            color: #2563eb;

            text-decoration-line: underline;
            text-underline-offset: 2px;

            cursor: pointer;
          }

          .dark .rich-text-editor-content a {
            color: #60a5fa;
          }

          /* ------------------------------------------------------------ */
          /* Inline code                                                  */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content code {
            padding: 0.125rem 0.25rem;

            border-radius: 0.25rem;

            background: #f3f4f6;

            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              "Liberation Mono",
              "Courier New",
              monospace;

            font-size: 0.75rem;
          }

          .dark .rich-text-editor-content code {
            background: #374151;
          }

          /* ------------------------------------------------------------ */
          /* Code block                                                   */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content pre {
            overflow-x: auto;

            margin-top: 0.5rem;
            margin-bottom: 0.5rem;

            padding: 0.75rem;

            border-radius: 0.5rem;

            background: #111827;
            color: #f9fafb;
          }

          .rich-text-editor-content pre code {
            padding: 0;

            background: transparent;

            color: inherit;
          }

          /* ------------------------------------------------------------ */
          /* Horizontal rule                                              */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content hr {
            margin-top: 1rem;
            margin-bottom: 1rem;

            border: 0;
            border-top: 1px solid #e5e7eb;
          }

          .dark .rich-text-editor-content hr {
            border-top-color: #374151;
          }

          /* ------------------------------------------------------------ */
          /* Selected text                                                */
          /* ------------------------------------------------------------ */

          .rich-text-editor-content ::selection {
            background: rgba(
              59,
              130,
              246,
              0.25
            );
          }
        `}
      </style>

      {/* ================================================================ */}
      {/* Editor container                                                 */}
      {/* ================================================================ */}

      <div
        className={[
          "overflow-hidden rounded-lg border",

          "border-gray-200 bg-white",

          "dark:border-gray-700 dark:bg-gray-800",

          "focus-within:border-brand-500",

          "focus-within:ring-1",

          "focus-within:ring-brand-500/20",

          "transition-colors duration-150",

          disabled ? "opacity-70" : "",
        ].join(" ")}
      >
        {/* -------------------------------------------------------------- */}
        {/* Toolbar                                                        */}
        {/* -------------------------------------------------------------- */}

        <div
          className="
            flex flex-wrap items-center gap-1

            border-b border-gray-200

            bg-gray-50

            px-2 py-2

            dark:border-gray-700

            dark:bg-gray-800/80
          "
        >
          {/* Bold */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={buttonClass(editor.isActive("bold"))}
            title="Bold"
          >
            <FaBold />
          </button>

          {/* Italic */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={buttonClass(editor.isActive("italic"))}
            title="Italic"
          >
            <FaItalic />
          </button>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />

          {/* Bullet list */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={buttonClass(editor.isActive("bulletList"))}
            title="Bullet list"
          >
            <FaListUl />
          </button>

          {/* Numbered list */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={buttonClass(editor.isActive("orderedList"))}
            title="Numbered list"
          >
            <FaListOl />
          </button>

          {/* Quote */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={buttonClass(editor.isActive("blockquote"))}
            title="Quote"
          >
            <FaQuoteRight />
          </button>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />

          {/* Add / edit link */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleLink}
            className={buttonClass(editor.isActive("link"))}
            title="Add or edit link"
          >
            <FaLink />
          </button>

          {/* Remove link */}
          <button
            type="button"
            disabled={disabled || !editor.isActive("link")}
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
            className={`${buttonClass()} disabled:cursor-not-allowed disabled:opacity-30`}
            title="Remove link"
          >
            <FaUnlink />
          </button>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />

          {/* Undo */}
          <button
            type="button"
            disabled={disabled || !editor.can().chain().focus().undo().run()}
            onClick={() => editor.chain().focus().undo().run()}
            className={`${buttonClass()} disabled:cursor-not-allowed disabled:opacity-30`}
            title="Undo"
          >
            <FaUndo />
          </button>

          {/* Redo */}
          <button
            type="button"
            disabled={disabled || !editor.can().chain().focus().redo().run()}
            onClick={() => editor.chain().focus().redo().run()}
            className={`${buttonClass()} disabled:cursor-not-allowed disabled:opacity-30`}
            title="Redo"
          >
            <FaRedo />
          </button>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Editable content                                               */}
        {/* -------------------------------------------------------------- */}

        <div className="relative">
          {!editor.getText().trim() && !editor.isFocused && (
            <span
              className="
                  pointer-events-none

                  absolute left-4 top-3

                  z-10

                  text-sm

                  text-gray-400
                "
            >
              {placeholder}
            </span>
          )}

          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

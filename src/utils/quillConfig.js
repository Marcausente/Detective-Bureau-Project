import ReactQuill, { Quill } from 'react-quill';

// ── Custom Divider (HR) Blot ──────────────────────────────────────────────────
const BlockEmbed = Quill.import('blots/block/embed');

class DividerBlot extends BlockEmbed {
    static create() {
        return super.create();
    }
}
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';

// Register only once (guard against double-registration in dev hot-reload)
try {
    Quill.register(DividerBlot);
} catch (e) {
    // already registered
}

// ── Toolbar modules factory ───────────────────────────────────────────────────
// Returns a fresh object each call so React doesn't share references between
// different ReactQuill instances.
export function makeQuillModules() {
    return {
        toolbar: {
            container: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: [] }, { background: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['blockquote', 'code-block'],
                ['link', 'divider'],
                ['clean'],
            ],
            handlers: {
                divider() {
                    const range = this.quill.getSelection(true);
                    if (range) {
                        // Insert a newline before the HR so it sits on its own line
                        this.quill.insertText(range.index, '\n', Quill.sources.USER);
                        this.quill.insertEmbed(range.index + 1, 'divider', true, Quill.sources.USER);
                        // Move cursor past the HR
                        this.quill.setSelection(range.index + 2, Quill.sources.SILENT);
                    }
                },
            },
        },
        clipboard: {
            matchVisual: false,
        },
    };
}

// ── Allowed formats ───────────────────────────────────────────────────────────
export const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'blockquote', 'code-block',
    'link',
    'divider',
];

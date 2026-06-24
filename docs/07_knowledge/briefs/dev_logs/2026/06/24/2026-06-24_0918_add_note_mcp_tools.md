# Dev Log: Add Note MCP Tools

- **Date**: 2026-06-24
- **Author**: Antigravity
- **Branch**: `feature/add-note-mcp-tools`

## 1. Overview of Changes

We registered and implemented the `note_list` (alias `list_notes`) and `note_get` (alias `get_note`) tools in the NotebookLM MCP server and Express HTTP wrapper.

### Modified Files:

1. **[src/types.ts](file:///home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/src/types.ts)**: Appended interface types (`NotebookNote`, `NoteListResult`, `NoteGetInput`, `NoteGetResult`).
2. **[src/tools/tool-names.ts](file:///home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/src/tools/tool-names.ts)**: Mapped legacy name aliases to canonical v2 names.
3. **[src/content/content-manager.ts](file:///home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/src/content/content-manager.ts)**:
   - Added imports for note types from `../types.js`.
   - Updated `findNoteElement` to search for `artifact-library-note` and `.artifact-title` elements.
   - Implemented `listNotes()` which scrolls the Studio panel to lazy-load note cards and returns note metadata.
   - Implemented `getNoteContent()` which locates note cards, clicks them, extracts editor content, and returns the full text.
4. **[src/tools/index.ts](file:///home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/src/tools/index.ts)**: Registered tool schemas and added `handleListNotes()` / `handleGetNote()` handlers.
5. **[src/index.ts](file:///home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/src/index.ts)**: Added switch cases to dispatch client tool calls.
6. **[src/http-wrapper.ts](file:///home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/src/http-wrapper.ts)**: Exposed Express POST endpoints `/content/notes/list` and `/content/notes/get`.

---

## 2. Technical Decisions

- **Decision: Custom Web Component selectors**: NotebookLM is built using custom components like `artifact-library-note` instead of standard `.note-item` classes. The locator queries were updated to correctly target these custom tags and their respective titles (`.artifact-title`).
- **Decision: Casting to `any` via `globalThis`**: Playwright's `page.evaluate()` executes javascript inside the browser window context where `document` is available. To avoid compilation errors during static Node.js build, we cast `globalThis` as `any` before fetching elements via `querySelector`.

---

## 3. Physical Verification Output

The compilation completed successfully. The integration test script `verify_note_tools.js` returned the following output:

```text
=== NOTE TOOLS VERIFICATION START: 2026-06-24T01:13:35.506Z ===
Notebook URL: https://notebooklm.google.com/notebook/d69f7f2a-d306-40ad-87d5-7f0d17da2c13
Initializing browser session...
✅ All 16 critical cookies are valid
✅ Persistent context ready!
Browser session initialized successfully.

--- 1. Testing listNotes() ---
📚 Listing notes in Studio panel...
✅ Clicked Studio tab
⏳ Scrolling Studio panel to load all notes...
🔍 Found 60 candidate note elements
✅ Successfully listed 30 notes
List Notes Success: true
Found 30 notes.
- Title: "第三十题：生产成本、管理费用、主营业务收入年度统计分析", ID: "N/A", Details: "12d ago"
- Title: "第二十九题：车辆维保费用管理审计", ID: "N/A", Details: "13d ago"
...

--- 2. Testing getNoteContent() for: "第三十题：生产成本、管理费用、主营业务收入年度统计分析" ---
📄 Fetching content of note: "第三十题：生产成本、管理费用、主营业务收入年度统计分析"
✅ Studio tab already active
✅ Extracted note content from element
✅ Retrieved note content (95 characters)
Get Note Content Success: true
Retrieved Title: "第三十题：生产成本、管理费用、主营业务收入年度统计分析"
Content Length: 95 characters
```

# NotebookLM MCP: Add Note List & Get Features Design

This document outlines the design and step-by-step implementation blueprint to add `note_list` (list notes) and `note_get` (get note content) features to the `@roomi-fields/notebooklm-mcp` codebase.

---

## 1. File Modification Overview

To register and support these new features, we need to modify 4 files:

1. **`src/types.ts`**: Add note list/get request & result interfaces.
2. **`src/content/content-manager.ts`**: Add methods to navigate, scroll, scrape note lists, and open/extract individual note contents.
3. **`src/tools/index.ts`**: Define MCP tool schemas for `note_list` and `note_get`, and map them to content-manager handlers.
4. **`src/index.ts`**: Add the new tool registrations to the main server schema.

---

## 2. Step 1: Define TypeScript Interfaces (`src/types.ts`)

Append the following interfaces to `src/types.ts`:

```typescript
export interface NotebookNote {
  id?: string;
  title: string;
  details?: string; // e.g. "7d ago"
}

export interface NoteListResult {
  success: boolean;
  notes: NotebookNote[];
  error?: string;
}

export interface NoteGetInput {
  noteTitle: string;
  noteId?: string;
}

export interface NoteGetResult {
  success: boolean;
  title: string;
  content: string;
  error?: string;
}
```

---

## 3. Step 2: Implement Browser Logic (`src/content/content-manager.ts`)

Based on our DOM analysis and screenshot validation:

- Note cards are custom `<artifact-library-note>` elements.
- Note titles reside in `.artifact-title` elements.
- Note details (timestamps) reside in `.artifact-details`.

We need to add two methods: `listNotes()` and `getNoteContent()`.

### Method A: `listNotes()`

Add this under the `Notes Management` section in `src/content/content-manager.ts`:

```typescript
  /**
   * List all notes in the NotebookLM Studio panel.
   * Handles scrolling inside the Studio panel to ensure all notes are loaded.
   */
  async listNotes(): Promise<NoteListResult> {
    log.info(`📚 Listing notes in Studio panel...`);
    try {
      // Step 1: Ensure we are in the Studio panel
      await this.navigateToStudio();
      await randomDelay(1000, 2000);

      // Step 2: Locate the scrollable container in the Studio panel
      // The notes list lives under the .studio-panel section
      const scrollContainerSelector = '.studio-panel, [class*="studio-panel"]';
      const containerExists = await this.page.locator(scrollContainerSelector).count() > 0;

      if (containerExists) {
        // Scroll the panel down a few times to trigger lazy load of old notes
        log.info('  ⏳ Scrolling Studio panel to load all notes...');
        for (let i = 0; i < 5; i++) {
          await this.page.evaluate((selector) => {
            const panel = document.querySelector(selector);
            if (panel) {
              panel.scrollTop = panel.scrollHeight;
            }
          }, scrollContainerSelector);
          await randomDelay(300, 500);
        }
      }

      // Step 3: Scrape note elements from the DOM
      const notes: NotebookNote[] = [];
      const seenTitles = new Set<string>();

      // Selectors based on verified DOM structure
      const noteItemSelector = 'artifact-library-note, [class*="artifact-item-button"]';
      const noteElements = await this.page.locator(noteItemSelector).all();

      log.info(`  🔍 Found ${noteElements.length} candidate note elements`);

      for (const el of noteElements) {
        try {
          const titleText = await el.locator('.artifact-title, [class*="artifact-title"]').first().textContent() || '';
          const detailsText = await el.locator('.artifact-details, [class*="artifact-details"]').first().textContent() || '';
          const noteId = await el.getAttribute('data-note-id') || await el.getAttribute('data-id') || undefined;

          const title = titleText.trim();
          if (title && !seenTitles.has(title)) {
            seenTitles.add(title);
            notes.push({
              id: noteId,
              title,
              details: detailsText.trim() || undefined
            });
          }
        } catch (e) {
          continue;
        }
      }

      log.success(`  ✅ Successfully listed ${notes.length} notes`);
      return { success: true, notes };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Failed to list notes: ${errorMsg}`);
      return { success: false, notes: [], error: errorMsg };
    }
  }
```

### Method B: `getNoteContent()`

Add this method to extract the text content of a note:

```typescript
  /**
   * Get the title and text content of a specific note by title or ID.
   */
  async getNoteContent(input: NoteGetInput): Promise<NoteGetResult> {
    const { noteTitle, noteId } = input;
    log.info(`📄 Fetching content of note: "${noteTitle || noteId}"`);
    try {
      await this.navigateToStudio();
      await randomDelay(500, 1000);

      // Reuse existing helper to find the note element
      const noteElement = await this.findNoteElement(noteTitle, noteId);
      if (!noteElement) {
        return {
          success: false,
          title: noteTitle || '',
          content: '',
          error: `Note not found: "${noteTitle || noteId}"`
        };
      }

      // Reuse existing helper to click note, wait, and extract content text
      const content = await this.extractNoteContent(noteElement, noteTitle);

      // Close the note popover/editor if open to return to clean state
      try {
        await this.page.keyboard.press('Escape');
        await randomDelay(200, 400);
      } catch {}

      if (content) {
        log.success(`  ✅ Retrieved note content (${content.length} characters)`);
        return {
          success: true,
          title: noteTitle || '',
          content
        };
      } else {
        return {
          success: false,
          title: noteTitle || '',
          content: '',
          error: 'Could not extract content from note editor.'
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Failed to get note content: ${errorMsg}`);
      return {
        success: false,
        title: noteTitle || '',
        content: '',
        error: errorMsg
      };
    }
  }
```

---

## 4. Step 3: Register MCP Tools (`src/tools/index.ts`)

### Part A: Add schema definitions

Add the following tool configurations inside the main tools list in `src/tools/index.ts`:

```typescript
  note_list: {
    name: 'note_list',
    description: 'List all user notes in the current notebook. Returns note titles, IDs and timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook_url: { type: 'string', description: 'Optional NotebookLM URL' },
        session_id: { type: 'string', description: 'Optional Session ID' }
      }
    }
  },
  note_get: {
    name: 'note_get',
    description: 'Retrieve the full title and text content of a specific note in the current notebook.',
    inputSchema: {
      type: 'object',
      properties: {
        note_title: { type: 'string', description: 'The title of the note' },
        note_id: { type: 'string', description: 'Optional ID of the note' },
        notebook_url: { type: 'string', description: 'Optional NotebookLM URL' },
        session_id: { type: 'string', description: 'Optional Session ID' }
      },
      required: ['note_title']
    }
  }
```

### Part B: Map handlers

In the `handleCallTool` switch-case block of `src/tools/index.ts`, add:

```typescript
      case 'note_list': {
        const { notebook_url, session_id } = args as any;
        log.info(`🔧 [TOOL] note_list called`);

        const session = await this.sessionManager.getOrCreateSession({
          notebookUrl: notebook_url,
          sessionId: session_id
        });

        const contentManager = session.contentManager;
        const result = await contentManager.listNotes();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'note_get': {
        const { note_title, note_id, notebook_url, session_id } = args as any;
        log.info(`🔧 [TOOL] note_get called: "${note_title}"`);

        const session = await this.sessionManager.getOrCreateSession({
          notebookUrl: notebook_url,
          sessionId: session_id
        });

        const contentManager = session.contentManager;
        const result = await contentManager.getNoteContent({
          noteTitle: note_title,
          noteId: note_id
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
```

---

## 5. Step 4: Add names to `src/tools/tool-names.ts` (if applicable)

Verify if tool names are declared as constants, and add:

```typescript
  list_notes: 'note_list',
  get_note: 'note_get',
```

---

## 6. How to Build & Test Locally

Run the following commands inside the repository to compile and register the updated MCP server:

```bash
# Install dependencies
npm install

# Compile the TypeScript codebase
npm run build

# Start the server proxy in stdio mode to verify
npm run start:proxy
```

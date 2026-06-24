# Architecture & Technical Tutorial: Scrape Custom Web Components in Playwright (NotebookLM Case Study)

This tutorial explains the architecture and implementation details for automating note retrieval in Google NotebookLM using Playwright. It aims to guide new developers on how to interact with Web Components and lazy-loaded containers in a non-standard UI environment.

---

## 1. Context & Architecture

NotebookLM's notes reside in the **Studio** panel. This panel behaves as a separate single-page view containing custom HTML5 elements.

```
                                  +-------------------+
                                  |    MCP Clients    |
                                  +---------+---------+
                                            | (JSON-RPC)
                                            v
                                  +---------+---------+
                                  |   MCP Server      |
                                  | (index.ts Router) |
                                  +---------+---------+
                                            |
                                            v
                                  +---------+---------+
                                  |    ToolHandlers   |
                                  | (index.ts Handler)|
                                  +---------+---------+
                                            |
                                            v
                                  +---------+---------+
                                  |   ContentManager  |
                                  | (Playwright Scrape|
                                  +---------+---------+
                                            |
                                            v
                                  +---------+---------+
                                  |    NotebookLM UI  |
                                  | (Browser Session) |
                                  +-------------------+
```

---

## 2. Technical Challenge 1: Lazy Loading in Scrollable Containers

When the Studio panel is loaded, Google NotebookLM only renders a subset of notes to conserve memory. If there are many notes, older notes will not be present in the DOM.

### Implementation Strategy: Programmatic Scrolling

We locate the `.studio-panel` element and scroll it to trigger lazy loading. Since the execution context is in the Node.js compiler, browser globals like `document` are not directly visible to the compiler. We bypass this by casting `globalThis` to `any`:

```typescript
const scrollContainerSelector = '.studio-panel, [class*="studio-panel"]';
const containerExists = (await this.page.locator(scrollContainerSelector).count()) > 0;

if (containerExists) {
  log.info('  ⏳ Scrolling Studio panel to load all notes...');
  for (let i = 0; i < 5; i++) {
    await this.page.evaluate((selector) => {
      const panel = (globalThis as any).document.querySelector(selector);
      if (panel) {
        panel.scrollTop = panel.scrollHeight;
      }
    }, scrollContainerSelector);
    await randomDelay(300, 500);
  }
}
```

---

## 3. Technical Challenge 2: Interacting with Custom Web Components

Standard locators searching for `.note-item` or `[class*="note"]` fail in NotebookLM because the note elements are encapsulated as custom tags (`artifact-library-note`).

### Selection Strategy

We query the elements using the verified selectors:

```typescript
const noteItemSelector = 'artifact-library-note, [class*="artifact-item-button"]';
const noteElements = await this.page.locator(noteItemSelector).all();
```

We then traverse inside each element to extract metadata:

```typescript
for (const el of noteElements) {
  try {
    const titleText =
      (await el.locator('.artifact-title, [class*="artifact-title"]').first().textContent()) || '';
    const detailsText =
      (await el.locator('.artifact-details, [class*="artifact-details"]').first().textContent()) ||
      '';
    const noteId =
      (await el.getAttribute('data-note-id')) || (await el.getAttribute('data-id')) || undefined;

    const title = titleText.trim();
    if (title && !seenTitles.has(title)) {
      seenTitles.add(title);
      notes.push({
        id: noteId,
        title,
        details: detailsText.trim() || undefined,
      });
    }
  } catch (e) {
    continue;
  }
}
```

---

## 4. Technical Challenge 3: Extracting Rich Text Content (ProseMirror fallbacks)

NotebookLM notes are opened in dialog popups powered by the ProseMirror editor. We extract text content by clicking the note card and querying fallback selectors:

```typescript
const contentSelectors = [
  '.note-content',
  '.note-body',
  '[class*="note-content"]',
  '[class*="noteContent"]',
  '[class*="note-body"]',
  '[class*="expanded"] [class*="content"]',
  '[class*="detail"] [class*="content"]',
  '.note-text',
  '[class*="text-content"]',
  '.ProseMirror',
  '[contenteditable="true"]',
  'article',
  '.content',
  '[role="article"]',
];
```

After extracting the content, we clean up the browser state by pressing `Escape` to close any open note editor popup:

```typescript
try {
  await this.page.keyboard.press('Escape');
  await randomDelay(200, 400);
} catch {}
```

---

## 5. Traceability

- **Dev Log**: [2026-06-24_0918_add_note_mcp_tools.md](../../dev_logs/2026/06/24/2026-06-24_0918_add_note_mcp_tools.md)
- **Specification**: [M1.1_note_tools_spec.md](../../../../../01_specs/M1.1_note_tools_spec.md)
- **Test Case**: [C1.1.1_list_and_get_notes.md](../../../../../06_tests/T1.1.1_implement_note_tools/C1.1.1_list_and_get_notes.md)

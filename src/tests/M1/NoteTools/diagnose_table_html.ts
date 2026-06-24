import fs from 'fs';
import path from 'path';
import { SessionManager } from '../../../session/session-manager.js';
import { AuthManager } from '../../../auth/auth-manager.js';
import { NotebookLibrary } from '../../../library/notebook-library.js';
import { CONFIG } from '../../../config.js';

async function main() {
  console.log('=== NOTE TABLE HTML DIAGNOSTIC START ===');

  const library = new NotebookLibrary();
  const activeNotebook = library.getActiveNotebook();
  const resolvedNotebookUrl = activeNotebook?.url || CONFIG.notebookUrl;

  const authManager = new AuthManager();
  const sessionManager = new SessionManager(authManager);

  try {
    const session = await sessionManager.getOrCreateSession(undefined, resolvedNotebookUrl);
    const page = session.getPage();

    if (!page) {
      throw new Error('Could not access browser page.');
    }

    // Go to Studio
    await page
      .locator('div.mdc-tab:has-text("Studio"), div.mdc-tab:has-text("工作台")')
      .first()
      .click();
    await page.waitForTimeout(3000);

    // Click "第四题"
    const noteSelector = 'artifact-library-note, [class*="artifact-item-button"]';
    const noteElements = await page.locator(noteSelector).all();
    let targetElement = null;
    for (const el of noteElements) {
      const title =
        (await el.locator('.artifact-title, [class*="artifact-title"]').first().textContent()) ||
        '';
      if (title.includes('第四题')) {
        targetElement = el;
        break;
      }
    }

    if (targetElement) {
      console.log('Clicking the target note...');
      await targetElement.click();

      // Wait for labs-tailwind-doc-viewer to be visible
      console.log('Waiting for labs-tailwind-doc-viewer:visible...');
      await page.waitForSelector('labs-tailwind-doc-viewer:visible, note-editor:visible', {
        state: 'visible',
        timeout: 10000,
      });

      const docViewer = page
        .locator('labs-tailwind-doc-viewer:visible, note-editor:visible')
        .first();
      const html = await docViewer.evaluate((e) => e.outerHTML);
      const text = await docViewer.evaluate((e) => e.textContent || '');

      const outputDir =
        '/home/xor/agy_workspace/session_20260609_162747/notebooklm-mcp/artifacts/test/T1.1.1_implement_note_tools';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(path.join(outputDir, 'note_fourth_html.html'), html, 'utf-8');
      fs.writeFileSync(path.join(outputDir, 'note_fourth_text.txt'), text, 'utf-8');
      console.log('Successfully saved note HTML and text to artifacts directory.');
    }

    await sessionManager.closeAllSessions();
  } catch (error) {
    console.error('Diagnostic error:', error);
    await sessionManager.closeAllSessions();
  }
}

main();

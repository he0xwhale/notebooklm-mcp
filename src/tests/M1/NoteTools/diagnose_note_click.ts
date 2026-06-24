import { SessionManager } from '../../../session/session-manager.js';
import { AuthManager } from '../../../auth/auth-manager.js';
import { NotebookLibrary } from '../../../library/notebook-library.js';
import { CONFIG } from '../../../config.js';

async function main() {
  console.log('=== NOTE CONTENT SELECTOR DIAGNOSTIC START ===');

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
      await page.waitForTimeout(5000); // wait for load

      // Search for element containing "第一部分"
      console.log('Searching for content elements...');
      const matches = await page.locator(':has-text("第一部分：业务通识篇")').all();
      console.log(`Found ${matches.length} matching elements.`);

      for (const el of matches) {
        try {
          const tagName = await el.evaluate((e) => e.tagName);
          const className = (await el.getAttribute('class')) || '';
          const id = (await el.getAttribute('id')) || '';
          const html = await el.evaluate((e) => e.outerHTML.substring(0, 200));
          console.log(`- Element: tag=${tagName}, class="${className}", id="${id}"`);
          console.log(`  HTML preview: ${html}\n`);
        } catch {
          // ignore error
        }
      }
    }

    await sessionManager.closeAllSessions();
  } catch (error) {
    console.error('Diagnostic error:', error);
    await sessionManager.closeAllSessions();
  }
}

main();

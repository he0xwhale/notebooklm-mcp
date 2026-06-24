import fs from 'fs';
import path from 'path';
import { SessionManager } from '../../../session/session-manager.js';
import { AuthManager } from '../../../auth/auth-manager.js';
import { NotebookLibrary } from '../../../library/notebook-library.js';
import { ContentManager } from '../../../content/content-manager.js';
import { CONFIG } from '../../../config.js';

async function main() {
  const logDir = path.join(process.cwd(), 'artifacts', 'test', 'T1.1.1_implement_note_tools');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, 'verify.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });

  function writeLog(message: string) {
    console.log(message);
    logStream.write(message + '\n');
  }

  writeLog(`=== NOTE TOOLS VERIFICATION START: ${new Date().toISOString()} ===`);

  try {
    const library = new NotebookLibrary();
    const activeNotebook = library.getActiveNotebook();
    const resolvedNotebookUrl = activeNotebook?.url || CONFIG.notebookUrl;

    if (!resolvedNotebookUrl) {
      throw new Error('No notebook URL configured or found in library.');
    }

    writeLog(`Notebook URL: ${resolvedNotebookUrl}`);

    const authManager = new AuthManager();
    const sessionManager = new SessionManager(authManager);

    writeLog('Initializing browser session...');
    const session = await sessionManager.getOrCreateSession(undefined, resolvedNotebookUrl);
    const page = session.getPage();

    if (!page) {
      throw new Error('Could not access browser page from session.');
    }

    writeLog('Browser session initialized successfully.');
    const contentManager = new ContentManager(page);

    // 1. List notes
    writeLog('\n--- 1. Testing listNotes() ---');
    const listResult = await contentManager.listNotes();
    writeLog(`List Notes Success: ${listResult.success}`);
    if (listResult.error) {
      writeLog(`List Notes Error: ${listResult.error}`);
    }
    writeLog(`Found ${listResult.notes.length} notes.`);

    for (const note of listResult.notes) {
      writeLog(
        `- Title: "${note.title}", ID: "${note.id || 'N/A'}", Details: "${note.details || 'N/A'}"`
      );
    }

    // 2. Get note content for "第四题" specifically
    const targetNote = listResult.notes.find((n) => n.title.includes('第四题'));
    if (targetNote) {
      writeLog(`\n--- 2. Testing getNoteContent() for: "${targetNote.title}" ---`);

      const getResult = await contentManager.getNoteContent({
        noteTitle: targetNote.title,
        noteId: targetNote.id,
      });

      writeLog(`Get Note Content Success: ${getResult.success}`);
      if (getResult.error) {
        writeLog(`Get Note Content Error: ${getResult.error}`);
      } else {
        writeLog(`Retrieved Title: "${getResult.title}"`);
        writeLog(`Content Length: ${getResult.content.length} characters`);
        writeLog(`Content:\n${getResult.content}`);
      }
    } else {
      writeLog(`\n--- 2. Warning: Could not find note with title containing "第四题" ---`);
    }

    writeLog('\nClosing sessions...');
    await sessionManager.closeAllSessions();
    writeLog('Verification completed successfully!');
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    writeLog(`\n❌ Error during verification: ${err}`);
    if (error instanceof Error && error.stack) {
      writeLog(error.stack);
    }
  } finally {
    logStream.end();
  }
}

main().catch(console.error);

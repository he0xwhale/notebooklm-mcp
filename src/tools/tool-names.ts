/**
 * Canonical (v2) tool names — a navigable `namespace.action` dot-notation tree.
 *
 * v2.0.0 renamed every tool from a flat snake_case list to this tree. The legacy
 * flat names still work everywhere — both the stdio server and the HTTP proxy
 * accept them as aliases — but `tools/list` advertises only the canonical names.
 *
 * This module has no heavy imports on purpose: both `tools/index.ts` and the
 * lightweight `stdio-http-proxy.ts` import it.
 */

/** Legacy flat name (still used internally by handlers) → canonical v2 name. */
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  // library.* — the local notebook library
  add_notebook: 'library.add',
  list_notebooks: 'library.list',
  get_notebook: 'library.get',
  select_notebook: 'library.select',
  update_notebook: 'library.update',
  remove_notebook: 'library.remove',
  search_notebooks: 'library.search',
  auto_discover_notebook: 'library.discover',
  get_library_stats: 'library.stats',
  // notebook.* — operations directly against NotebookLM
  ask_question: 'notebook.ask',
  create_notebook: 'notebook.create',
  delete_notebooks_from_nblm: 'notebook.delete',
  list_notebooks_from_nblm: 'notebook.list',
  // session.* — chat sessions
  list_sessions: 'session.list',
  close_session: 'session.close',
  reset_session: 'session.reset',
  // source.* — notebook sources
  add_source: 'source.add',
  delete_source: 'source.delete',
  // content.* — generated Studio content
  generate_content: 'content.generate',
  list_content: 'content.list',
  download_content: 'content.download',
  // note.* — Studio notes
  create_note: 'note.create',
  save_chat_to_note: 'note.save_chat',
  convert_note_to_source: 'note.to_source',
  // auth.* — Google authentication
  setup_auth: 'auth.setup',
  de_auth: 'auth.logout',
  re_auth: 'auth.switch',
  // server.* — server lifecycle
  get_health: 'server.health',
  cleanup_data: 'server.cleanup',
  // vault.* — offline answer caching
  batch_to_vault: 'vault.batch',
};

/** Canonical v2 dot-notation name → legacy flat name. */
export const CANONICAL_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_CANONICAL).map(([legacy, canonical]) => [canonical, legacy])
);

/** Resolve any accepted name (canonical or legacy) to the legacy name used internally. */
export function toLegacyName(name: string): string {
  return CANONICAL_TO_LEGACY[name] ?? name;
}

/** Resolve a legacy name to its canonical v2 name (unknown names pass through). */
export function toCanonicalName(name: string): string {
  return LEGACY_TO_CANONICAL[name] ?? name;
}

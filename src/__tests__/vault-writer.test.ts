/**
 * vault-writer tests — path-containment & slug-prefix sanitization
 *
 * Covers the hardening shipped in v2.0.3 for the vault.batch tool, in
 * response to the path-traversal report (issue #15). When
 * NOTEBOOKLM_VAULT_ROOT is set, callers cannot escape the configured root
 * with absolute paths or `..` segments. slug_prefix is always sanitized so
 * a caller cannot inject path separators via the filename component.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import os from 'os';
import { makeSlug, sanitizeSlugPrefix, resolveVaultDir } from '../utils/vault-writer.js';

describe('vault-writer hardening', () => {
  const originalRoot = process.env.NOTEBOOKLM_VAULT_ROOT;

  afterEach(() => {
    if (originalRoot === undefined) {
      delete process.env.NOTEBOOKLM_VAULT_ROOT;
    } else {
      process.env.NOTEBOOKLM_VAULT_ROOT = originalRoot;
    }
  });

  describe('sanitizeSlugPrefix', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeSlugPrefix('')).toBe('');
      expect(sanitizeSlugPrefix(undefined)).toBe('');
    });

    it('passes safe alphanumeric prefixes through', () => {
      expect(sanitizeSlugPrefix('thesis-ch1')).toBe('thesis-ch1');
    });

    it('strips forward slashes', () => {
      expect(sanitizeSlugPrefix('../etc/passwd')).not.toMatch(/\//);
      expect(sanitizeSlugPrefix('a/b/c')).toBe('abc');
    });

    it('strips backslashes', () => {
      expect(sanitizeSlugPrefix('a\\b\\c')).toBe('abc');
    });

    it('strips traversal sequences', () => {
      expect(sanitizeSlugPrefix('..foo')).toBe('foo');
      expect(sanitizeSlugPrefix('....foo')).toBe('foo');
    });

    it('strips NUL bytes', () => {
      expect(sanitizeSlugPrefix('a\0b')).toBe('ab');
    });

    it('caps length at 64 chars', () => {
      const long = 'a'.repeat(200);
      expect(sanitizeSlugPrefix(long).length).toBe(64);
    });
  });

  describe('makeSlug', () => {
    it('sanitizes the prefix so traversal cannot leak into the filename', () => {
      const slug = makeSlug('hello world', '../escape', 0);
      expect(slug).not.toMatch(/\.\./);
      expect(slug).not.toMatch(/\//);
      expect(slug).toBe('escape-001-hello-world');
    });
  });

  describe('resolveVaultDir — env unset (legacy behaviour)', () => {
    beforeEach(() => {
      delete process.env.NOTEBOOKLM_VAULT_ROOT;
    });

    it('resolves any caller-supplied path (backward compatible)', () => {
      const tmp = path.join(os.tmpdir(), 'nblm-test-vault');
      expect(resolveVaultDir(tmp)).toBe(path.resolve(tmp));
    });

    it('rejects empty input', () => {
      expect(() => resolveVaultDir('')).toThrow(/required/i);
    });
  });

  describe('resolveVaultDir — env set (strict containment)', () => {
    const root = path.join(os.tmpdir(), 'nblm-vault-root');

    beforeEach(() => {
      process.env.NOTEBOOKLM_VAULT_ROOT = root;
    });

    it('accepts a relative path under the root', () => {
      const out = resolveVaultDir('thesis');
      expect(out).toBe(path.resolve(root, 'thesis'));
    });

    it('accepts an absolute path that lives under the root', () => {
      const inside = path.join(root, 'sub', 'deep');
      expect(resolveVaultDir(inside)).toBe(path.resolve(inside));
    });

    it('rejects absolute paths outside the root', () => {
      expect(() => resolveVaultDir('/etc/passwd')).toThrow(/escape/i);
    });

    it('rejects relative traversal sequences', () => {
      expect(() => resolveVaultDir('../../etc')).toThrow(/escape/i);
    });

    it('rejects sibling directories that share a name prefix', () => {
      // root = /tmp/nblm-vault-root → /tmp/nblm-vault-root-evil must be refused
      const sibling = root + '-evil';
      expect(() => resolveVaultDir(sibling)).toThrow(/escape/i);
    });
  });
});

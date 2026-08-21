import { describe, expect, it } from 'vitest';
import { messageOf } from './api';

/**
 * REGRESSION EVIDENCE for the "[object Object]" defect.
 *
 * A real Super Admin class creation was refused by the database and the app
 * showed the operator the literal text "[object Object]". The cause was that
 * PostgREST returns `JSON.parse(body)` on the `{ data, error }` path — a plain
 * object, never an Error — so `error instanceof Error` was false and the
 * fallback `String(error)` produced that string for EVERY database refusal in
 * the application.
 *
 * The single property that matters is asserted first and separately: nothing
 * this function returns may ever be "[object Object]" again.
 */
describe('messageOf — API errors must always be readable', () => {
  it('never returns "[object Object]", whatever it is handed', () => {
    const inputs: unknown[] = [
      { message: 'new row violates row-level security policy for table "classes"', code: '42501' },
      { code: 'PGRST301' },
      {},
      Object.create(null),
      [],
      new Error('boom'),
      'plain string',
      null,
      undefined,
      42,
    ];
    for (const input of inputs) {
      expect(messageOf(input)).not.toBe('[object Object]');
    }
  });

  it('reads a PostgrestError the way PostgREST actually shapes one', () => {
    // The exact shape @supabase/postgrest-js assigns from JSON.parse(body).
    const postgrestError = {
      code: '23503',
      details: 'Key (institution_id)=(00000000-0000-0000-0000-000000000000) is not present in table "institutions".',
      hint: null,
      message: 'insert or update on table "classes" violates foreign key constraint "classes_institution_id_fkey"',
    };
    const text = messageOf(postgrestError);
    expect(text).toContain('violates foreign key constraint');
    expect(text).toContain('is not present in table "institutions"');
    expect(text).toContain('[23503]');
  });

  it('carries the SQLSTATE so a refusal can be identified exactly', () => {
    expect(messageOf({ message: 'permission denied for table classes', code: '42501' })).toBe(
      'permission denied for table classes [42501]',
    );
  });

  it('still prefers a real Error instance message', () => {
    expect(messageOf(new Error('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('falls back to the object JSON rather than losing the payload entirely', () => {
    expect(messageOf({ unexpected: 'shape' })).toBe('{"unexpected":"shape"}');
  });

  it('passes a plain string straight through', () => {
    expect(messageOf('could not reach the server')).toBe('could not reach the server');
  });
});

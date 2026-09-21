/**
 * Select the internal mailbox without initializing the mail provider.
 * Explicit deployment configuration always wins over the site fallback.
 */
export function resolveAdminEmailCandidate(defaultRecipientEmail: string): string {
  return (
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    defaultRecipientEmail
  );
}

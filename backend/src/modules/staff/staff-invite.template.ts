import type { InvitableRole } from "@plateflow/shared";

const ROLE_LABELS: Record<InvitableRole, string> = {
  MANAGER: "Manager",
  CHEF: "Chef",
  WAITER: "Waiter",
};

// A name is manager-supplied free text that ends up inside the email body, so it
// is escaped rather than interpolated raw: markup in a name would otherwise let
// the invitation carry arbitrary content, including a second link.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type Params = {
  fullName: string;
  role: InvitableRole;
  inviteUrl: string;
  expiresAt: Date;
};

export const buildStaffInviteEmail = ({
  fullName,
  role,
  inviteUrl,
  expiresAt,
}: Params) => {
  const name = escapeHtml(fullName);
  const roleLabel = ROLE_LABELS[role];
  const expiresOn = expiresAt.toUTCString();

  return {
    subject: `You're invited to join PlateFlow as ${roleLabel}`,
    text: [
      `Hi ${fullName},`,
      "",
      `You have been invited to join PlateFlow as a ${roleLabel}.`,
      "",
      "Set your password to activate your account:",
      inviteUrl,
      "",
      `This link expires on ${expiresOn}. If it expires, ask your manager to send a new invitation.`,
      "",
      "If you were not expecting this invitation, you can ignore this email.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">You're invited to PlateFlow</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${name},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
        You have been invited to join PlateFlow as a <strong>${roleLabel}</strong>.
        Set your password to activate your account.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">
        Set your password
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
        This link expires on ${expiresOn}. If it expires, ask your manager to send a new invitation.
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
        If the button does not work, paste this address into your browser:<br />
        <span style="word-break:break-all;">${inviteUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
        If you were not expecting this invitation, you can ignore this email.
      </p>
    </div>
  </body>
</html>`,
  };
};

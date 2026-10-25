import { describe, expect, it } from "vitest";
import { buildStaffInviteEmail } from "../../../src/modules/staff/staff-invite.template.js";

const expiresAt = new Date("2026-11-01T12:00:00Z");

describe("buildStaffInviteEmail", () => {
  it("names the role and carries the invitation link", () => {
    const email = buildStaffInviteEmail({
      fullName: "Nadia Rahman",
      role: "WAITER",
      inviteUrl: "https://app.example.com/accept-invite?token=abc123",
      expiresAt,
    });

    expect(email.subject).toContain("Waiter");
    expect(email.text).toContain("Hi Nadia Rahman,");
    expect(email.text).toContain(
      "https://app.example.com/accept-invite?token=abc123"
    );
    expect(email.text).toContain(expiresAt.toUTCString());
    expect(email.html).toContain('href="https://app.example.com/accept-invite?token=abc123"');
  });

  it("escapes manager-supplied names before they reach the HTML body", () => {
    const email = buildStaffInviteEmail({
      fullName: `<script>alert("x")</script> & 'y'`,
      role: "CHEF",
      inviteUrl: "https://app.example.com/accept-invite?token=abc123",
      expiresAt,
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    );
    // The plain-text alternative is not HTML, so it keeps the name as written.
    expect(email.text).toContain(`Hi <script>alert("x")</script> & 'y',`);
  });

  it("labels a manager invitation without assuming the owner role", () => {
    const email = buildStaffInviteEmail({
      fullName: "Sam",
      role: "MANAGER",
      inviteUrl: "https://app.example.com/accept-invite?token=abc123",
      expiresAt,
    });

    expect(email.subject).toContain("Manager");
    expect(email.html).toContain("<strong>Manager</strong>");
  });
});

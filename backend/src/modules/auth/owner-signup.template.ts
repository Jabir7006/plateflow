type Params = {
  signupUrl: string;
  expiresAt: Date;
};

// The request body carries no name yet, so the email stays deliberately
// generic: it must not disclose whether an account already exists.
export const buildOwnerSignupEmail = ({ signupUrl, expiresAt }: Params) => {
  const expiresOn = expiresAt.toUTCString();

  return {
    subject: "Finish setting up your restaurant on PlateFlow",
    text: [
      "Someone asked to set up a restaurant on PlateFlow with this email address.",
      "",
      "Continue here:",
      signupUrl,
      "",
      `This link expires on ${expiresOn}.`,
      "If you did not ask for this, you can ignore this email.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">Set up your restaurant</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
        Someone asked to set up a restaurant on PlateFlow with this email address.
        Choose your restaurant name, timezone, name and password to finish.
      </p>
      <a href="${signupUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">
        Continue setup
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
        This link expires on ${expiresOn}. If it has expired, request a new one from the signup page.
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
        If the button does not work, paste this address into your browser:<br />
        <span style="word-break:break-all;">${signupUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
        If you did not ask for this, you can ignore this email.
      </p>
    </div>
  </body>
</html>`,
  };
};

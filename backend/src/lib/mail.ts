import { Resend } from "resend";
import { ENV } from "../config/env.js";
import AppError from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/http.js";

const resend = new Resend(ENV.RESEND_API_KEY);

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Resolves on success and throws on failure, so a caller can treat "the email
 * went out" as a precondition for whatever it does next.
 *
 * The SDK resolves `{ data, error }` instead of rejecting, so the error branch
 * has to be checked explicitly — an unchecked send reports success and leaves
 * the recipient with nothing.
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<void> => {
  const { error } = await resend.emails.send({
    from: ENV.MAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (!error) {
    return;
  }

  console.error("Failed to send email:", { to, subject, error });

  // The only failure worth telling the caller to retry. Everything else —
  // an unverified sender, a revoked key — needs a config fix, not a retry, so
  // it is reported as a generic upstream failure rather than surfaced verbatim.
  if (error.name === "rate_limit_exceeded") {
    throw new AppError(
      "Email service is rate limited, please try again shortly",
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  throw new AppError(
    "Could not send the invitation email",
    HTTP_STATUS.BAD_GATEWAY
  );
};

import type { LiveErrorCode } from "./types";

/** A live run that cannot go on, with a code the page can explain. */
export class LiveError extends Error {
  readonly code: LiveErrorCode;
  constructor(code: LiveErrorCode, message: string) {
    super(message);
    this.name = "LiveError";
    this.code = code;
  }
}

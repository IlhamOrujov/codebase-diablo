"""Gemini provider for Diablo: send one question, get the answer text back."""

import os

import httpx
from google import genai
from google.genai import errors, types

# The documented id. "gemini-3.1-pro" alone does not exist in the API.
# Override with GEMINI_MODEL in .env.
DEFAULT_MODEL = "gemini-3.1-pro-preview"


class GeminiError(RuntimeError):
    """Gemini could not give us an answer. Carries the HTTP status when there is one."""

    def __init__(self, message: str, status_code: int | None = None, status: str | None = None):
        super().__init__(message)
        self.status_code = status_code  # e.g. 404
        self.status = status  # e.g. "NOT_FOUND"


def create_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is missing. Copy .env.example to .env and set it there.")
    return genai.Client(api_key=api_key)


def ask(question: str, system: str | None = None) -> str:
    """Send `question` to Gemini and return the answer text.

    `system` is an optional system instruction. Raises ValueError for an empty
    question and GeminiError when the API fails or returns no text.
    """
    if not question or not question.strip():
        raise ValueError("question is empty")

    client = create_client()
    model = os.getenv("GEMINI_MODEL") or DEFAULT_MODEL
    config = types.GenerateContentConfig(system_instruction=system) if system else None

    try:
        response = client.models.generate_content(model=model, contents=question, config=config)
    except errors.APIError as err:
        # The server answered with an error (bad key, unknown model, quota...).
        raise GeminiError(
            f"Gemini API error {err.code} {err.status}: {err.message}",
            status_code=err.code,
            status=err.status,
        ) from err
    except httpx.TransportError as err:
        # We never got an answer (no network, DNS failure, timeout).
        raise GeminiError(f"Could not reach the Gemini API ({type(err).__name__}): {err}") from err

    text = response.text
    if not text or not text.strip():
        raise GeminiError(f"Gemini returned no text ({_why_empty(response)}, model {model})")
    return text


def _why_empty(response: types.GenerateContentResponse) -> str:
    feedback = response.prompt_feedback
    if feedback and feedback.block_reason:
        return f"prompt blocked: {_name(feedback.block_reason)}"
    if response.candidates and response.candidates[0].finish_reason:
        return f"finish reason: {_name(response.candidates[0].finish_reason)}"
    return "no reason given"


def _name(reason) -> str:
    # The SDK gives enums such as FinishReason.SAFETY; show just "SAFETY".
    return getattr(reason, "name", str(reason))


# The old name from the draft, kept so existing callers keep working.
ask_gemini = ask

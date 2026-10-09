"""Tests for the Gemini provider. No key and no network: the client is patched."""

import os
import unittest
from unittest.mock import patch

import httpx
from google.genai import errors, types

from diablo.providers import gemini

# Every test starts from a known environment, so a developer's real .env or
# shell variables can never leak in.
FAKE_ENV = {"GEMINI_API_KEY": "test-key-not-real"}


def text_response(text: str) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                content=types.Content(role="model", parts=[types.Part(text=text)]),
                finish_reason=types.FinishReason.STOP,
            )
        ]
    )


@patch.dict(os.environ, FAKE_ENV, clear=True)
@patch("diablo.providers.gemini.genai.Client")
class AskTests(unittest.TestCase):
    def sent(self, client_cls):
        """The keyword arguments ask() passed to generate_content."""
        return client_cls.return_value.models.generate_content.call_args.kwargs

    def test_missing_key(self, client_cls):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "GEMINI_API_KEY is missing"):
                gemini.ask("Why?")
        client_cls.assert_not_called()

    def test_empty_key_counts_as_missing(self, client_cls):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=True):
            with self.assertRaisesRegex(gemini.GeminiError, "GEMINI_API_KEY is missing"):
                gemini.ask("Why?")

    def test_empty_question(self, client_cls):
        for question in ["", "   ", "\n\t"]:
            with self.subTest(question=question):
                with self.assertRaisesRegex(ValueError, "question is empty"):
                    gemini.ask(question)
        client_cls.assert_not_called()

    def test_success_returns_text(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = text_response("A plan.")
        self.assertEqual(gemini.ask("Why?"), "A plan.")
        client_cls.assert_called_once_with(api_key="test-key-not-real")
        self.assertEqual(self.sent(client_cls)["contents"], "Why?")

    def test_default_model_when_unset(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = text_response("ok")
        gemini.ask("Why?")
        self.assertEqual(self.sent(client_cls)["model"], "gemini-3.1-pro-preview")

    def test_default_model_when_empty(self, client_cls):
        # .env.example ships "GEMINI_MODEL=" with no value.
        client_cls.return_value.models.generate_content.return_value = text_response("ok")
        with patch.dict(os.environ, {"GEMINI_MODEL": ""}):
            gemini.ask("Why?")
        self.assertEqual(self.sent(client_cls)["model"], "gemini-3.1-pro-preview")

    def test_model_from_env(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = text_response("ok")
        with patch.dict(os.environ, {"GEMINI_MODEL": "gemini-3.5-flash"}):
            gemini.ask("Why?")
        self.assertEqual(self.sent(client_cls)["model"], "gemini-3.5-flash")

    def test_system_prompt_is_passed_through(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = text_response("ok")
        gemini.ask("Why?", system="You are Diablo's reasoning component.")
        config = self.sent(client_cls)["config"]
        self.assertEqual(config.system_instruction, "You are Diablo's reasoning component.")

    def test_no_system_prompt_sends_no_config(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = text_response("ok")
        gemini.ask("Why?")
        self.assertIsNone(self.sent(client_cls)["config"])

    def test_empty_response_names_finish_reason(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = types.GenerateContentResponse(
            candidates=[types.Candidate(finish_reason=types.FinishReason.SAFETY)]
        )
        with self.assertRaisesRegex(gemini.GeminiError, "no text.*finish reason: SAFETY"):
            gemini.ask("Why?")

    def test_blocked_prompt_names_block_reason(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = types.GenerateContentResponse(
            prompt_feedback=types.GenerateContentResponsePromptFeedback(block_reason="PROHIBITED_CONTENT")
        )
        with self.assertRaisesRegex(gemini.GeminiError, "prompt blocked: PROHIBITED_CONTENT"):
            gemini.ask("Why?")

    def test_whitespace_only_response_is_empty(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = text_response("  \n")
        with self.assertRaisesRegex(gemini.GeminiError, "no text"):
            gemini.ask("Why?")

    def test_api_error_keeps_status_and_message(self, client_cls):
        api_error = errors.ClientError(
            404,
            {"error": {"code": 404, "message": "models/nope is not found", "status": "NOT_FOUND"}},
        )
        client_cls.return_value.models.generate_content.side_effect = api_error
        with self.assertRaises(gemini.GeminiError) as caught:
            gemini.ask("Why?")
        err = caught.exception
        self.assertEqual(err.status_code, 404)
        self.assertEqual(err.status, "NOT_FOUND")
        self.assertIn("models/nope is not found", str(err))
        self.assertIs(err.__cause__, api_error)  # chained with `raise ... from err`

    def test_network_error_is_wrapped_and_chained(self, client_cls):
        network_error = httpx.ConnectError("nodename nor servname provided")
        client_cls.return_value.models.generate_content.side_effect = network_error
        with self.assertRaisesRegex(gemini.GeminiError, "Could not reach the Gemini API") as caught:
            gemini.ask("Why?")
        self.assertIsNone(caught.exception.status_code)
        self.assertIs(caught.exception.__cause__, network_error)

    def test_ask_gemini_is_an_alias(self, client_cls):
        self.assertIs(gemini.ask_gemini, gemini.ask)


if __name__ == "__main__":
    unittest.main()

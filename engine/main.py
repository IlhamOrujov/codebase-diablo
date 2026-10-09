"""Send Diablo's research question to Gemini and print the plan it returns."""

import sys
from pathlib import Path

from dotenv import load_dotenv

from diablo.prompts import SYSTEM_PROMPT
from diablo.providers.gemini import GeminiError, ask
from diablo.research import contents


def main() -> int:
    # Read engine/.env (the file next to this one) into the environment.
    # A variable already exported in your shell wins over the file.
    load_dotenv(Path(__file__).with_name(".env"))

    try:
        answer = ask(contents, system=SYSTEM_PROMPT)
    except GeminiError as err:
        # Expected failures (no key, API error, no network) get a short message.
        # Bugs in our own code are not caught, so they still show a traceback.
        print(f"error: {err}", file=sys.stderr)
        return 1

    print(answer)
    return 0


if __name__ == "__main__":
    sys.exit(main())

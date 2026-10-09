# Diablo engine (Python)

The Python side of Diablo. For now it has one job: send a research question to
Gemini, Diablo's reasoning model, and print the plan that comes back. It has no
agent loop, no tools and no code execution. The model plans experiments; it
does not run them.

```
engine/
  main.py                     entry point: loads .env, asks, prints
  diablo/prompts.py           SYSTEM_PROMPT (who the model is, what it must never invent)
  diablo/research.py          `contents`: the research question for this investigation
  diablo/providers/gemini.py  everything Gemini-specific; exposes ask()
  tests/test_gemini.py        provider tests, no key and no network
  .env.example                template for your private .env
  requirements.txt            exact versions this was tested with
```

## Run it

All commands run from the `engine/` folder.

```bash
cd engine
python3 -m venv .venv            # a private Python just for this project
source .venv/bin/activate        # your prompt now starts with (.venv)
pip install -r requirements.txt
```

**Set up your key without it leaving your machine.** Get a key from Google AI
Studio (https://aistudio.google.com/apikey). Then:

```bash
cp .env.example .env
open -e .env                     # or: nano .env
```

Paste the key after `GEMINI_API_KEY=` in the editor and save. Do not paste it
into a terminal command (it ends up in your shell history) or into any chat.
To check it is set without printing it:

```bash
python -c "from dotenv import dotenv_values; print('key set:', bool(dotenv_values('.env').get('GEMINI_API_KEY')))"
git check-ignore .env            # prints ".env": git will never commit it
```

Run the investigation and the tests:

```bash
python main.py                   # prints the research plan, or "error: ..." and exits 1
python -m pytest                 # no key needed, no network used
```

Without a key, `python main.py` prints this and exits with status 1:

```
error: GEMINI_API_KEY is missing. Copy .env.example to .env and set it there.
```

To try another model, set `GEMINI_MODEL=gemini-3.5-flash` (for example) in
`.env`. Left empty, it uses `gemini-3.1-pro-preview`.

## What was wrong with the draft

The draft is the first commit on this branch, so
`git log -p --reverse -- diablo/providers/gemini.py` shows it and then every
change made to it. Bug by bug:

1. **`create_client()` was called but its result was thrown away.** A function's
   return value disappears unless you store it: `client = create_client()`.
   Later, `client.models...` raised `NameError: name 'client' is not defined`.
2. **The model name was also thrown away.** `os.getenv("GEMINI_MODEL", ...)`
   computed a string and nothing kept it.
3. **`generate_content()` had no arguments.** Fixing bug 1 only reveals the next
   error: `TypeError: Models.generate_content() missing 2 required keyword-only
   arguments: 'model' and 'contents'`.
4. **`question` was never used.** The function accepted it and never sent it.
5. **Nothing was returned.** A Python function without `return` returns `None`,
   so even a successful call would have given the caller `None`.
6. **`gemini-3.1-pro` is not a model id.** Google documents Gemini 3.1 Pro as
   `gemini-3.1-pro-preview`
   (https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview).
   With bugs 1 to 5 fixed, the old default would fail with `404 NOT_FOUND`.
7. **Empty questions were not rejected.** `""` or `"   "` would cost a request
   and return an error or nonsense.
8. **Empty or blocked answers were not detected.** `response.text` is `None`
   when the model is blocked by safety filters or runs out of tokens, and the
   program would have printed `None` as if it were the answer.
9. **`load_dotenv()` ran when the module was imported.** Importing a library
   should not change the environment. It also made tests read whatever `.env`
   the developer had. It now runs once, in `main.py`, with the file's path given
   explicitly.

## The new provider, line by line

`diablo/providers/gemini.py`:

| Line | Why it is there |
|---|---|
| `import httpx` | The SDK talks HTTP through httpx; we catch its network errors. |
| `from google.genai import errors, types` | `errors` holds `APIError`; `types` holds `GenerateContentConfig`. |
| `DEFAULT_MODEL = "gemini-3.1-pro-preview"` | One place for the documented id. A capitalised module-level name signals "constant". |
| `class GeminiError(RuntimeError)` | One error type for every expected failure, so `main.py` needs one `except`. It keeps `status_code` (404) and `status` (`NOT_FOUND`). |
| `if not api_key: raise GeminiError(...)` | Fail before any network call, with a message that says how to fix it. An empty `GEMINI_API_KEY=` counts as missing. |
| `def ask(question: str, system: str \| None = None) -> str` | The interface. `str \| None = None` means "optional string". Type hints do not change behaviour; they document it and let editors check it. An Anthropic provider can offer the same `ask()`. |
| `if not question or not question.strip()` | `.strip()` removes spaces and newlines, so `"   "` becomes `""`, which is falsy. |
| `os.getenv("GEMINI_MODEL") or DEFAULT_MODEL` | `or` returns the right side when the left is `None` or `""`, which covers both "unset" and "empty". |
| `types.GenerateContentConfig(system_instruction=system) if system else None` | The system prompt travels separately from the question. With no system prompt we send no config at all. |
| `client.models.generate_content(model=..., contents=..., config=...)` | The request. The arguments are keyword-only (note the `*` in its signature), so `model=` must be written out. |
| `except errors.APIError as err: raise GeminiError(...) from err` | Google answered with an error. `from err` chains the original, so a traceback shows both and nothing is hidden. The code and message are kept. |
| `except httpx.TransportError as err` | We never got an answer: no network, DNS, timeout. |
| `text = response.text` | The SDK joins the text parts of the first candidate; it is `None` if there are none. |
| `_why_empty(response)` | Says why there is no text: `prompt blocked: ...` or `finish reason: SAFETY` / `MAX_TOKENS`. |
| `ask_gemini = ask` | The draft's name still works. Functions are values in Python, so this is an alias, not a copy. |

## How a request flows

```
main.py
  load_dotenv(engine/.env)            puts GEMINI_API_KEY (and GEMINI_MODEL) in os.environ
  ask(contents, system=SYSTEM_PROMPT)
    question blank?                   -> ValueError
    create_client()                   -> GeminiError if no key; no network yet
    model  = GEMINI_MODEL or default
    config = GenerateContentConfig(system_instruction=SYSTEM_PROMPT)
    client.models.generate_content(...)
      POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
           key in the x-goog-api-key header, never in the URL
      200  -> response: candidates[0].content.parts[].text, finish_reason, prompt_feedback
      4xx  -> errors.ClientError  -> GeminiError(status_code=4xx)
      5xx  -> errors.ServerError  -> GeminiError(status_code=5xx)
      no connection / timeout -> httpx.TransportError -> GeminiError
    response.text empty?              -> GeminiError("no text (finish reason: ...)")
    return text
  print(answer)            or   print("error: ...") to stderr, exit 1
```

## When something goes wrong

First, decide which kind of error you have.

- **A Python error** comes with a traceback ending in a line inside our own files
  (`main.py`, `diablo/...`). The code itself is wrong, or the environment is not
  set up. `main.py` deliberately does not catch these, so you see exactly where
  they happen.
- **An API error** is printed by `main.py` as one line starting
  `error: Gemini API error <code> <STATUS>: ...` and exit status 1. The code ran
  fine; Google refused the request. It is raised with `from err`, so if you call
  `ask()` yourself the traceback also shows the SDK's original `ClientError` or
  `ServerError`.

### Python errors

| You see | It means | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'google'` or `'dotenv'` (a kind of `ImportError`) | You are using a Python without the packages. | `source .venv/bin/activate`, then `pip install -r requirements.txt`. Check with `which python`: it should end in `engine/.venv/bin/python`. |
| `ModuleNotFoundError: No module named 'diablo'` | Python cannot see the package. | Run from `engine/`: `python main.py`, `python -m pytest`. |
| `ImportError: cannot import name 'genai' from 'google'` | The old `google-generativeai` package is installed instead of `google-genai`. | `pip install -r requirements.txt`. |
| `NameError: name 'x' is not defined` | A variable is used before it is assigned, or the name is misspelt. Bug 1 above. | Assign the value: `client = create_client()`. |
| `TypeError: ... missing 2 required keyword-only arguments` | A function was called with the wrong arguments. Bug 3 above. | Compare with the signature: `help(client.models.generate_content)`. |
| `ValueError: question is empty` | `ask()` was given a blank question. | Pass real text. |

### API errors

| You see | It means | Fix |
|---|---|---|
| `error: GEMINI_API_KEY is missing` | No key in `.env` or the shell. Raised before any request. | Fill in `.env` as described above. |
| `400 INVALID_ARGUMENT: API key not valid` or `401` | The key is wrong, has stray spaces or quotes, or was deleted. Google's docs list 401 for a bad key; the `generateContent` endpoint has long answered 400 with this message. | Copy the key again from AI Studio into `.env`. |
| `403 PERMISSION_DENIED` | The key is real but may not do this: wrong project, API not enabled, or the key was reported as leaked and blocked. | Check the key's project in AI Studio; if it leaked, create a new one. |
| `404 NOT_FOUND: models/... is not found` | The model id does not exist, or no longer exists. | Fix `GEMINI_MODEL`. Current ids: https://ai.google.dev/gemini-api/docs/models |
| `429 RESOURCE_EXHAUSTED` | Rate limit or quota reached. Limits depend on the model and your usage tier. | Wait and retry; check limits at https://ai.google.dev/gemini-api/docs/rate-limits. google-genai 2.29.0 does not retry by default. |
| `500 INTERNAL`, `503 UNAVAILABLE`, `504 DEADLINE_EXCEEDED` | A problem on Google's side, or the model is overloaded. | Retry later. |
| `Could not reach the Gemini API (ConnectError)` or `(ConnectTimeout)`, no status code | No network, DNS failure, proxy or firewall, or a timeout. Google never answered. | Check your connection: `curl -sI https://generativelanguage.googleapis.com`. |
| `Gemini returned no text (finish reason: SAFETY)` | The request worked but the answer was withheld. `MAX_TOKENS` means it ran out of room; `prompt blocked: ...` means the question itself was refused. | Rephrase the question, or for `MAX_TOKENS` ask for a shorter answer. |

Full list of codes: https://ai.google.dev/gemini-api/docs/api-errors

## Tests

`tests/test_gemini.py` replaces `genai.Client` with a mock
(`unittest.mock.patch`) and clears the environment for every test, so the
tests run without a key, without the network, and without reading your `.env`.
They check: the missing key, empty questions, the returned text, the model from
`GEMINI_MODEL` and its default, the system prompt being passed through, empty and
blocked responses, and API and network errors keeping their status code and
original cause. Every one of them fails against the original draft, starting
with the fact that it had no `ask()` at all.

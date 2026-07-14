# Contributing

## Development

Requirements:

- Node.js 20 or newer
- Git

Run the test suite before submitting changes:

```bash
npm test
```

Keep changes focused. Add tests for scoring, validation, data-contract, browser
extraction, or generated-output behavior changes.

## Data Safety

Never commit:

- real resumes or contact details;
- real job exports;
- generated `output/` directories;
- API keys, cookies, session data, or browser profiles.

Use `examples/` and synthetic fixtures in tests. Generated candidate claims
must remain traceable to the current run evidence.

## Pull Requests

Describe:

1. the behavior changed;
2. the evidence or data contract affected;
3. the tests run;
4. any privacy or compatibility risk.

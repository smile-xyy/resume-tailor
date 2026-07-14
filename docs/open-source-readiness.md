# Open-Source Readiness

## Automated Gate

Run:

```bash
npm test
npm run release:audit
```

The audit checks tracked files for common secrets, personal phone numbers,
absolute user paths, required public documentation, a license, and removed
project names in Git history.

## Clean-History Release

Do not publish the current repository history when the history audit fails.
After choosing a license and committing the final tree:

```bash
node scripts/export_public_snapshot.mjs ../resume-tailor-public
cd ../resume-tailor-public
git init
git add .
git commit -m "Initial public release"
npm test
npm run release:audit
```

Publish only the new repository.

## Manual Gate

- Choose and review an open-source license.
- Confirm the repository name and public description.
- Enable private vulnerability reporting on the repository host.
- Verify extension screenshots or store assets contain no account information.
- Run one clean-clone workflow using only files from `examples/`.

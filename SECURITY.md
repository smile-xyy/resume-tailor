# Security Policy

## Supported Version

Security fixes target the latest release on the default branch.

## Reporting

Use the repository host's private vulnerability-reporting feature. Do not open
a public issue containing personal resume data, authentication material, or an
unredacted job export.

Include:

- affected command or file;
- minimal reproduction using synthetic data;
- expected and actual behavior;
- potential privacy impact.

## Local Data Boundary

The project is designed to run locally. It does not require uploading resumes,
job data, cookies, or generated reports to a hosted service. Browser-extension
changes must preserve this boundary unless a future feature clearly asks for
user consent.

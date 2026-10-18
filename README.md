# Parcelproof

A small file handoff tool: the browser hashes selected files with Web Crypto,
a Node HTTP API validates and canonicalizes the manifest, and Node's SHA-256
implementation produces a receipt. The browser independently checks that receipt.
File contents never leave the browser; names, sizes and checksums are submitted.
A receipt verifies content integrity and does not authenticate a sender.

Run `npm run build` then `PORT=3000 npm start`. No dependencies or secrets.
The checked-in generated assets allow the same source to run without runtime filesystem reads.

Limits: 1–12 uniquely named files, 2 MiB each, 8 MiB in total; JSON manifest at most
32 KiB. The canonical UTF-8 representation is JSON with keys `version`, `files`;
files are sorted by JavaScript string order, and each file has keys `name`, `size`,
`sha256`. The representation has no whitespace. SHA-256 values use lowercase hex.
Receipts can be downloaded, compared with another selection, and restored on reload.
Only a receipt is retained in localStorage; file contents are never persisted.

Synthetic Ship case 37. Local and Dev test evidence lives outside this public repo.

# BelgoBase conversation route — 26 September 2026

The desktop and web interfaces retain their existing platform adapters. This release adds the same automatic ready-search, continuation and reviewed Excel flow to both. Shared behavioral tests execute against both actual HTML sources. The files are not byte-identical: existing web localization and browser-specific export/voice behavior is preserved.

The UI hash is in release.json. The authenticated deployed workspace hash also includes the translation catalog, browser adapters, CSS and Git commit. Local proof is distinct from production and PC1 proof.

# Haru cognitive reference archive

Created/updated at: 2026-06-02T15:14:04

This archive stores publicly downloadable PDFs, open datasets, public code repositories, saved web pages, and metadata derived from `deep-research-report.md`.

## Folder layout

- `papers/`: open paper PDFs downloaded from public publisher, Europe PMC, institutional, or public report URLs.
- `official-tools/`: public forms or guide PDFs referenced by the report. These remain reference material and may still carry usage restrictions.
- `data/`: public datasets and dataset metadata.
- `code/`: public GitHub repositories cloned as implementation references, not clinically validated product code.
- `web-pages/`: official/commercial pages and fallback article HTML where direct PDFs were unavailable.
- `metadata/`: source link extraction, PubMed/OpenAlex metadata, download manifest, and file inventory.

## Current status counts

- `downloaded_pdf`: 15 manifest entries
- `downloaded_data`: 13 manifest entries
- `downloaded_metadata`: 11 manifest entries
- `saved_html`: 26 manifest entries
- `saved_challenge_html`: 4 manifest entries
- `cloned`: 13 GitHub repositories
- `generated`: 3 metadata files
- `copied`: 1 source report copy
- `not_downloaded`: 20 restricted, commercial, unavailable, or blocked items

`metadata/report_url_coverage.csv` maps every unique URL extracted from `deep-research-report.md` to a manifest status. At the latest check, all 55 report URLs were covered by a downloaded file, saved page, metadata fallback, cloned repository, or an explicit `not_downloaded` record.

2026-06-02 recovery note:

- The local archive was rebuilt from `metadata/download_manifest.csv` after local folder loss.
- Final manifest local-path missing count: 0.
- Rebuilt `metadata/current_file_inventory.csv` records 2023 files.
- Recovery audit logs and restore scripts are stored in `C:\project\saerok-memory\recovery_audit\`.
- `wps_stroop.html` initially returned HTTP 403 with the default request and was restored after retrying with browser-like request headers.

## Important limitations

- Restricted/commercial clinical test materials were not downloaded.
- Some PubMed original papers did not expose a public PMC PDF. PubMed metadata and an OpenAlex open-access status check are saved instead.
- OpenAlex reported the seven PubMed original-paper DOI records checked here as closed or without a public repository full text, so no extra OA PDFs were added from those DOI records.
- Unpaywall was not used for final OA lookup because it requires the caller's own email address and no user email was available in this workspace run.
- Some PMC PDF endpoints returned browser challenge pages or Europe PMC 500 responses; HTML fallbacks are saved and marked in the manifest.
- The MDPI Five Word Test adaptation PDF was downloaded from MDPI's public resource host after the report URL itself returned HTTP 403 from the local shell environment.
- SAGE, ResearchGate, Nature Protocols, and several commercial assessment pages did not provide locally downloadable public PDFs in this environment; do not bypass publisher or commercial access controls.
- Use this archive for grant/product research and implementation reference only. Do not copy official clinical test content into the app without license and expert review.

## Folder size summary

- `data/`: 14 files, about 314.06 MB
- `code/`: 1947 files, about 166.30 MB
- `web-pages/`: 30 files, about 4.80 MB
- `papers/`: 8 files, about 3.59 MB
- `official-tools/`: 6 files, about 1.77 MB
- `metadata/`: 17 files, about 0.53 MB
- Total archive size: about 0.48 GB across 2023 files, including this README

See `metadata/download_manifest.csv` for source URLs, local paths, statuses, notes, byte sizes, and SHA-256 hashes.

## Product application stance

This archive should support a more useful Haru product direction than a purely defensive “no medical judgment” posture. Haru should use credible medical and cognitive-science sources to design its own evidence-informed attention/risk framework.

The allowed application is:

- build original Haru routines from broad cognitive domains;
- store repeated activity metadata, reaction patterns, recall changes, drawing telemetry, language-fluency signals, and caregiver observations;
- combine those signals into Haru-specific advisory levels for users, families, caregivers, or counselors;
- show a startup or first-run disclaimer that Haru advisory outputs are not medical diagnosis, official screening results, treatment, or prevention claims;
- explain the basis for each advisory level and recommend professional consultation when repeated patterns or caregiver concerns justify it.

The forbidden application remains:

- copying official clinical test forms, items, stimuli, scoring rubrics, or cutoffs;
- calling Haru outputs MMSE, MoCA, CIST, K-MMSE, AD8, GPCOG, TICS, SAGE, SLUMS, ACE-III, or other official scores;
- presenting external population norms or clinical risk estimates as if they directly validate Haru;
- claiming disease detection, clinical validation, treatment, or prevention without a future Haru validation study.

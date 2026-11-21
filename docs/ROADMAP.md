# PDFRivo roadmap

## Phase 1 — Initial toolkit

- [x] PDF merge; split into page groups (ZIP download); rotate; delete pages
- [x] Text watermarks; page numbers; JPG/PNG/WebP to PDF
- [x] Resize, compress, convert and crop JPG/PNG/WebP images
- [x] Responsive UI; per-tool static routes; browser-only processing
- [x] Basic unit tests and automated build workflow
- [ ] End-to-end tests with real files and mobile browsers
- [ ] Accessibility review; performance benchmark; verified deployment

## Phase 2 — Better PDF workflows

- [ ] Thumbnail previews, visual page rearrangement and multi-step workflows
- [ ] PDF to JPG/PNG with page and output-quality selections
- [ ] True PDF size reduction with measured before/after size
- [ ] Improved form handling and more binary-file test fixtures
- [ ] Useful, original instructions and examples on each tool page

## Phase 3 — Advanced utilities

- [ ] OCR of scanned PDFs
- [ ] Secure redaction with irreversibility tests
- [ ] Cryptographic PDF signing versus drawn signature placement
- [ ] Word and other Office conversions with fidelity review
- [ ] More image formats and common photo presets
- [ ] Carefully disclosed opt-in backend only for tasks that cannot be processed locally

## Monetization

Consider AdSense and voluntary donations after launch, content quality, privacy policy, consent management, and ads placement reviews. No ads or analytics SDKs are included in the prototype.

## Known limitations

Split by groups creates one PDF per comma-delimited range. Multiple groups are returned as a ZIP. Basic watermark fonts handle printable ASCII only. Lossy image outputs may be larger than originals. Browser memory may constrain file sizes. PDF transformations can affect sophisticated document features. Always inspect outputs.

## QA improvements (Phase 1 follow-up)

- Added PDF and image processing unit tests using generated sample files and mocked browser Canvas.
- Changed Split PDF default to **all pages** (up to 200) to avoid silently omitting pages.
- Corrected PDF and Image header navigation to apply category filters and scroll to the tool catalogue.
- Display image output size compared with the original; compression can sometimes increase file size.
- Manual cross-browser and complex-document verification is still pending.

## Phase 2 — Visual PDF Interface v1

- [x] Visual PDF organizer route and homepage shortcut
- [x] Local PDF.js page thumbnail rendering with lazy loading
- [x] Drag-and-drop reordering plus accessible arrow controls
- [x] Per-page rotation, page removal and multi-file imports
- [x] Selection, partial export, reset and final PDF download
- [x] Automated exported-document order/rotation tests
- [ ] Manual Chrome, Firefox, Safari and mobile QA
- [ ] Large and image-heavy file benchmarks
- [ ] Review annotations, form fields and existing signatures
- [ ] Integrate visual previews with all specialized PDF tools

## Phase 3 — Inline PDF page previews

- [x] Page thumbnails displayed within Merge, Split, Rotate and Delete PDF Pages
- [x] Merge PDF previews reflect the file order controlled by existing move buttons
- [x] Click page thumbnails to generate split/delete page ranges
- [x] Rotate selected pages rather than only the whole document
- [x] Page selection parsing and selected-rotation tests
- [ ] Test with scanned documents, landscape pages and large PDFs
- [ ] Browser/mobile QA and keyboard accessibility verification
- [ ] Image tool previews, interactive crop, PDF-to-image and compression

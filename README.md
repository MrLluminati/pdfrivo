# PDFRivo

Free, privacy-first PDF and image utilities that process selected files in the browser.

**Status:** Initial prototype. The code has not yet passed end-to-end browser testing. Test with non-sensitive sample documents before relying on it.

## Available tools

PDF: merge, split by page groups, rotate, delete pages, add page numbers, watermark, and convert images to PDF.

Images: resize, compress as JPG/WebP, convert JPG/PNG/WebP, and crop by pixel coordinates.

## Local development

Node.js 22+ is recommended.

```bash
npm install
npm run dev
```

Tests and production build:

```bash
npm test
npm run build
npm run preview
```

## Hosting

Connect this GitHub repository to **Cloudflare Pages**. Set the build command to `npm run build` and the output directory to `dist`. The public domain `pdfrivo.com` is planned but not connected to this project yet. GitHub is the source host; Cloudflare Pages is the proposed website host.

## Privacy

Implemented PDF processing uses `pdf-lib` and `jszip` bundled into the site; image processing uses the browser Canvas API. The app does not include a file upload endpoint and does not transmit document contents to a processing server. Normal website requests still reach the hosting provider.

Important PDF forms, annotations, metadata, or existing digital signatures may not survive transformations unchanged. Confirm outputs before submitting them. Browser memory, damaged files, encrypted PDFs, and unsupported inputs can cause errors.

**Not yet available:** effective PDF compression, OCR, secure redaction, faithful Word/Office conversion, cryptographic signing, and server-side processing. Advertising, payments and tracking are not enabled.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md). New features should be developed in PRs and tested before merging to `main`.

## License

No project license has been selected. Third-party dependencies retain their own licenses.

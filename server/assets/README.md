# Certificate PDF

Certificates are rendered from **HTML/CSS** (Future Minds design) via Puppeteer:

- `src/templates/certificateStyles.css` — layout and styling
- `src/templates/certificateHtml.js` — builds the HTML document with dynamic fields

The React preview mirror lives in `client/src/components/CertificateDocument.jsx`.

Dynamic fields: `studentName`, `courseTitle`, `issueDate`, `instructorName`, `serialNumber`.

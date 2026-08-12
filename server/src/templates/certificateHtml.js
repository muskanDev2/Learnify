const fs = require('fs');
const path = require('path');
const { getCertificateAssetUris } = require('./certificateAssets');

const stylesPath = path.join(__dirname, 'certificateStyles.css');
let cachedStyles = '';

function getStyles() {
  if (!cachedStyles) {
    cachedStyles = fs.readFileSync(stylesPath, 'utf8');
  }
  return cachedStyles;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCompletionDate(date) {
  const d = new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
}

function buildCertificateHtml(data) {
  const studentName = escapeHtml(data.studentName || 'Student');
  const courseTitle = escapeHtml(data.courseTitle || 'Course');
  const instructorName = escapeHtml(data.instructorName || '');
  const serialNumber = escapeHtml(data.serialNumber || '');
  const completedOn = formatCompletionDate(data.issueDate || data.completionDate);

  const serialHtml = serialNumber
    ? `<div class="certificate-serial">Certificate ID: ${serialNumber}</div>`
    : '';

  const instructorLine = instructorName
    ? `<p class="certificate-instructor-line">Course Instructor: ${instructorName}</p>`
    : '';

  const leftSignatureTitle = 'PROGRAM DIRECTOR';
  const leftSignatureRole = 'Future Minds Summit Thailand 2026';
  const rightSignatureTitle = 'CHAIRPERSON';
  const rightSignatureRole = 'Global Youth Network';
  const assets = getCertificateAssetUris();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Certificate</title>
<style>${getStyles()}</style>
</head>
<body>
<div class="certificate">
  <div class="outer-pattern">
    <div class="corner corner-tl"><span></span><span></span><span></span></div>
    <div class="corner corner-tr"><span></span><span></span><span></span></div>
    <div class="corner corner-bl"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="corner corner-br"><span></span><span></span><span></span><span></span><span></span></div>
  </div>
  <div class="paper">
    <div class="logo organizer-logo">
      <img class="brand-logo gyn-logo" src="${assets.gynLogo}" alt="Global Youth Network" />
    </div>
    <div class="organized-by">ORGANIZED BY:-</div>
    <div class="summit-title">
      <img class="brand-logo fmst-logo" src="${assets.fmstLogo}" alt="Future Minds Summit Bangkok Thailand 2026" />
    </div>
    <div class="sdg-column">
      <div class="sdg sdg4"><strong>4</strong>QUALITY<br>EDUCATION</div>
      <div class="sdg sdg5"><strong>5</strong>GENDER<br>EQUALITY</div>
      <div class="sdg sdg9"><strong>9</strong>INDUSTRY,<br>INNOVATION</div>
      <div class="sdg sdg13"><strong>13</strong>CLIMATE<br>ACTION</div>
    </div>
    <div class="certificate-heading">
      <div class="script">Certificate</div>
      <div class="participation">OF COURSE COMPLETION</div>
    </div>
    <div class="presented-to">THIS CERTIFICATE IS PROUDLY PRESENTED TO</div>
    <div class="student-name">${studentName}</div>
    <div class="body-copy">
      <p>
        In recognition of the successful completion of the course
        <span class="green">${courseTitle}</span>
        having fulfilled the prescribed course requirements and demonstrated satisfactory understanding of the course content.
      </p>
      ${instructorLine}
      <div class="event-date">COMPLETED ON ${escapeHtml(completedOn)}</div>
    </div>
    <div class="bottom">
      <div class="signature left">
        <img class="signature-image" src="${assets.signatureSaba}" alt="Saba signature" />
        <div class="signature-line"></div>
        <div class="signature-name">${leftSignatureTitle}</div>
        <div class="signature-role">${leftSignatureRole}</div>
      </div>
      <div class="bottom-logo left">
        <div class="sdg-word-top">SUSTAINABLE<br>DEVELOPMENT</div>
      </div>
      <div class="bottom-logo right">
        <div class="sdg-word-goals"><span>G</span><span>O</span><span>A</span><span>L</span><span>S</span></div>
      </div>
      <div class="signature right">
        <img class="signature-image" src="${assets.signatureShazil}" alt="Shazil signature" />
        <div class="signature-line"></div>
        <div class="signature-name">${rightSignatureTitle}</div>
        <div class="signature-role">${rightSignatureRole}</div>
      </div>
      <div class="seal">Certificate of<br>Achievement</div>
    </div>
    ${serialHtml}
  </div>
</div>
</body>
</html>`;
}

module.exports = {
  buildCertificateHtml,
};

import '../styles/certificateDocument.css';

function formatCompletionDate(date) {
  const d = new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
}

/**
 * Browser preview — same layout and wording as PDF HTML template.
 */
export default function CertificateDocument({
  studentName = '',
  courseTitle = '',
  instructorName = '',
  issueDate = null,
  serialNumber = '',
}) {
  const completedOn = formatCompletionDate(issueDate);

  return (
    <div className="certificate certificatePreviewRoot">
      <div className="outer-pattern">
        <div className="corner corner-tl"><span /><span /><span /></div>
        <div className="corner corner-tr"><span /><span /><span /></div>
        <div className="corner corner-bl"><span /><span /><span /><span /><span /></div>
        <div className="corner corner-br"><span /><span /><span /><span /><span /></div>
      </div>

      <div className="paper">
        <div className="logo organizer-logo">
          <div className="organizer-mark" />
          <div className="organizer-text">
            <span className="name-1">Global Youth</span>
            <span className="name-2">NETWORK</span>
            <span className="tagline">EMPOWERING YOUTH</span>
          </div>
        </div>

        <div className="organized-by">ORGANIZED BY:-</div>

        <div className="summit-title">
          <div className="future">FUTURE</div>
          <div className="minds">
            <span className="summit-arrow" />
            MINDS
          </div>
          <div className="summit">SUMMIT</div>
          <div className="location">BANGKOK THAILAND 2026</div>
        </div>

        <div className="sdg-column">
          <div className="sdg sdg4"><strong>4</strong>QUALITY<br />EDUCATION</div>
          <div className="sdg sdg5"><strong>5</strong>GENDER<br />EQUALITY</div>
          <div className="sdg sdg9"><strong>9</strong>INDUSTRY,<br />INNOVATION</div>
          <div className="sdg sdg13"><strong>13</strong>CLIMATE<br />ACTION</div>
        </div>

        <div className="certificate-heading">
          <div className="script">Certificate</div>
          <div className="participation">OF COURSE COMPLETION</div>
        </div>

        <div className="presented-to">THIS CERTIFICATE IS PROUDLY PRESENTED TO</div>

        <div className="student-name">{studentName}</div>

        <div className="body-copy">
          <p>
            In recognition of the successful completion of the course{' '}
            <span className="green">{courseTitle}</span> having fulfilled the prescribed course requirements and
            demonstrated satisfactory understanding of the course content.
          </p>
          {instructorName ? <p className="certificate-instructor-line">Course Instructor: {instructorName}</p> : null}
          <div className="event-date">COMPLETED ON {completedOn}</div>
        </div>

        <div className="bottom">
          <div className="signature left">
            <div className="signature-line" />
            <div className="signature-name">PROGRAM DIRECTOR</div>
            <div className="signature-role">Future Minds Summit Thailand 2026</div>
          </div>

          <div className="bottom-logo left">
            <div className="sdg-word-top">
              SUSTAINABLE
              <br />
              DEVELOPMENT
            </div>
          </div>

          <div className="bottom-logo right">
            <div className="sdg-word-goals">
              <span>G</span>
              <span>O</span>
              <span>A</span>
              <span>L</span>
              <span>S</span>
            </div>
          </div>

          <div className="signature right">
            <div className="signature-line" />
            <div className="signature-name">CHAIRPERSON</div>
            <div className="signature-role">Global Youth Network</div>
          </div>

          <div className="seal">
            Certificate of
            <br />
            Achievement
          </div>
        </div>

        {serialNumber ? <div className="certificate-serial">Certificate ID: {serialNumber}</div> : null}
      </div>
    </div>
  );
}

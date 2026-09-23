interface MeetingEndedScreenProps {
  companyName?: string;
  title?: string;
  logoUrl?: string;
}

export function MeetingEndedScreen({ companyName, title, logoUrl }: MeetingEndedScreenProps) {
  return (
    <div className="waiting-banner">
      {logoUrl && <img className="waiting-banner-logo" src={logoUrl} alt={companyName ?? 'Company logo'} />}
      <div className="waiting-banner-card">
        <h1>{companyName}</h1>
        <h2>{title}</h2>
        <div className="waiting-banner-rule" />
        <p>
          The Meeting has now concluded
          <br />
          Thank you for your participation
        </p>
      </div>
    </div>
  );
}

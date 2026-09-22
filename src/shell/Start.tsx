/** Startbildschirm: Auswahl des Bereichs. */
import { Icon } from '../shared/icons';
import { AppIcon, MailaenderLogo } from '../shared/logos';
import { BEREICHE } from './bereiche';
import { zumBereich } from './router';

export function Start() {
  return (
    <div className="start">
      <div className="start-inner">
        <header className="start-kopf">
          <AppIcon size={52} />
          <div className="start-kopf-text">
            <h1>MC Plan</h1>
            <p>Bitte einen Bereich wählen.</p>
          </div>
          <div className="start-logo">
            <MailaenderLogo height={34} />
          </div>
        </header>

        <div className="start-kacheln">
          {BEREICHE.map((b) => (
            <button key={b.id} type="button" className="bereich-kachel" onClick={() => zumBereich(b.id)}>
              <span className="bereich-kachel-icon">
                <Icon name={b.icon} size={26} strokeWidth={1.4} />
              </span>
              <span className="bereich-kachel-text">
                <strong>{b.titel}</strong>
                {b.untertitel ? <span className="bereich-kachel-sub">{b.untertitel}</span> : null}
                <span className="bereich-kachel-text-lang">{b.beschreibung}</span>
              </span>
              {b.inVorbereitung ? <span className="badge">In Vorbereitung</span> : null}
              <span className="bereich-kachel-pfeil">
                <Icon name="chevron" size={16} />
              </span>
            </button>
          ))}
        </div>

        <p className="start-fuss">
          Die Bereiche arbeiten unabhängig voneinander – jeder mit eigenem Datenbestand und eigenen
          Einstellungen. Daten werden lokal im Browser gespeichert.
        </p>
      </div>
    </div>
  );
}

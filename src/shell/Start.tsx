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
          <AppIcon size={38} />
          <div className="start-kopf-text">
            <h1>MC Plan</h1>
            <p>Bitte einen Bereich wählen.</p>
          </div>
          <div className="start-logo">
            <MailaenderLogo height={30} />
          </div>
        </header>

        <div className="start-kacheln">
          {BEREICHE.map((b) => (
            <button key={b.id} type="button" className="bereich-kachel" onClick={() => zumBereich(b.id)}>
              <span className="bereich-kachel-bild">
                <Icon name={b.icon} size={64} strokeWidth={1.3} />
                {b.inVorbereitung ? <span className="bereich-kachel-marke">In Vorbereitung</span> : null}
              </span>
              <span className="bereich-kachel-inhalt">
                <strong className="bereich-kachel-titel">{b.titel}</strong>
                {b.untertitel ? <span className="bereich-kachel-sub">{b.untertitel}</span> : null}
                <span className="bereich-kachel-text">{b.beschreibung}</span>
                <span className="bereich-kachel-pfeil">
                  <Icon name="chevron" size={16} />
                </span>
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

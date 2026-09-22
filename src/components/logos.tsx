import { useState } from 'react';

/**
 * Bildmarken der Anwendung.
 *
 * Das App-Zeichen ist als SVG hinterlegt und bleibt damit in jeder Größe
 * scharf. Die Wortmarke Mailänder Consult stammt aus der Originaldatei
 * `public/mailaender-consult.svg` und wird nur über die Höhe skaliert.
 */

/** Hausfarbe nach dem Logo Mailänder Consult. */
export const MARKE_BLAU = '#24456e';

/** App-Zeichen: zwei Blätter mit Prozesslinie – in der Seitenleiste. */
export function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      <rect width="64" height="64" rx="15" fill={MARKE_BLAU} />
      {/* hinteres Blatt */}
      <path
        d="M15 17h9M15 17v30h30v-7"
        stroke="#ffffff"
        strokeOpacity="0.45"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* vorderes Blatt mit umgeschlagener Ecke */}
      <path d="M21 10h16l12 12v31H21z" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" />
      <path d="M36.6 10.4V22.4h12" stroke="#ffffff" strokeWidth="3.6" strokeLinejoin="round" />
      {/* Prozesslinie */}
      <path
        d="M29 26v12h11"
        stroke="#ffffff"
        strokeOpacity="0.62"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#ffffff" fillOpacity="0.62">
        <circle cx="29" cy="26" r="4.2" />
        <circle cx="29" cy="38" r="4.2" />
        <circle cx="40" cy="38" r="4.2" />
      </g>
    </svg>
  );
}

/** Dateiname der Originalmarke unter `public/`. */
export const MAILAENDER_DATEI = 'mailaender-consult.svg';

/**
 * Wortmarke Mailänder Consult für die Kopfzeile.
 *
 * Verwendet wird die Originaldatei `public/mailaender-consult.svg`; sie wird
 * ausschließlich über die Höhe skaliert, das Seitenverhältnis bleibt damit
 * unverändert. Fehlt die Datei, erscheint ersatzweise eine schlichte
 * Nachzeichnung, damit die Kopfzeile nicht leer bleibt.
 */
export function MailaenderLogo({ height = 34 }: { height?: number }) {
  const [original, setOriginal] = useState(true);

  if (original) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}${MAILAENDER_DATEI}`}
        alt="Mailänder Consult"
        style={{ height, width: 'auto', display: 'block' }}
        onError={() => setOriginal(false)}
      />
    );
  }

  return (
    <svg
      width={(height * 1000) / 248}
      height={height}
      viewBox="0 0 1000 248"
      fill="none"
      role="img"
      aria-label="Mailänder Consult"
      style={{ display: 'block', flex: 'none' }}
    >
      <g
        fill={MARKE_BLAU}
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="104"
        letterSpacing="-2"
      >
        <text x="0" y="92">
          Mailänder
        </text>
        <text x="695" y="226" textAnchor="end">
          Consult
        </text>
      </g>
      <g stroke={MARKE_BLAU} strokeWidth="26" fill="none">
        <path d="M748 13v222h108V128z" />
        <path d="M987 13v222H879V128z" />
      </g>
    </svg>
  );
}

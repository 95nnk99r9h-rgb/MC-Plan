/**
 * Sehr schlanker XLSX-Schreiber ohne externe Abhängigkeit.
 *
 * Erzeugt eine gültige Arbeitsmappe (OOXML) als ZIP-Datei. Die Einträge werden
 * unkomprimiert abgelegt ("stored"), was der ZIP-Spezifikation entspricht und
 * von Excel, LibreOffice und Numbers gelesen wird.
 */

export type Zelle = string | number | null | undefined;

export interface Blatt {
  name: string;
  /** Erste Zeile wird als Kopfzeile fett gesetzt. */
  zeilen: Zelle[][];
}

/* ----------------------------- ZIP ------------------------------- */

const crcTabelle = (() => {
  const tabelle = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabelle[i] = c >>> 0;
  }
  return tabelle;
})();

function crc32(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < daten.length; i++) c = crcTabelle[(c ^ daten[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEintrag {
  name: string;
  laenge: number;
  crc: number;
  offset: number;
}

function schreibeZip(dateien: { name: string; inhalt: string }[]): Blob {
  const encoder = new TextEncoder();
  const teile: Uint8Array[] = [];
  const eintraege: ZipEintrag[] = [];
  let offset = 0;

  const zahl = (wert: number, bytes: number) => {
    const out = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) out[i] = (wert >>> (i * 8)) & 0xff;
    return out;
  };

  const anhaengen = (...bloecke: Uint8Array[]) => {
    for (const b of bloecke) {
      teile.push(b);
      offset += b.length;
    }
  };

  for (const datei of dateien) {
    const name = encoder.encode(datei.name);
    const daten = encoder.encode(datei.inhalt);
    const crc = crc32(daten);
    eintraege.push({ name: datei.name, laenge: daten.length, crc, offset });

    anhaengen(
      zahl(0x04034b50, 4), // Signatur lokaler Dateikopf
      zahl(20, 2), // benötigte Version
      zahl(0x0800, 2), // Flags: Dateinamen in UTF-8
      zahl(0, 2), // Methode: unkomprimiert
      zahl(0, 2), // Uhrzeit
      zahl(0, 2), // Datum
      zahl(crc, 4),
      zahl(daten.length, 4),
      zahl(daten.length, 4),
      zahl(name.length, 2),
      zahl(0, 2), // keine Zusatzfelder
      name,
      daten,
    );
  }

  const verzeichnisStart = offset;
  for (const e of eintraege) {
    const name = encoder.encode(e.name);
    anhaengen(
      zahl(0x02014b50, 4), // Signatur Zentralverzeichnis
      zahl(20, 2),
      zahl(20, 2),
      zahl(0x0800, 2),
      zahl(0, 2),
      zahl(0, 2),
      zahl(0, 2),
      zahl(e.crc, 4),
      zahl(e.laenge, 4),
      zahl(e.laenge, 4),
      zahl(name.length, 2),
      zahl(0, 2),
      zahl(0, 2),
      zahl(0, 2),
      zahl(0, 2),
      zahl(0, 4),
      zahl(e.offset, 4),
      name,
    );
  }

  anhaengen(
    zahl(0x06054b50, 4), // Ende des Zentralverzeichnisses
    zahl(0, 2),
    zahl(0, 2),
    zahl(eintraege.length, 2),
    zahl(eintraege.length, 2),
    zahl(offset - verzeichnisStart, 4),
    zahl(verzeichnisStart, 4),
    zahl(0, 2),
  );

  return new Blob(teile as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ---------------------------- XLSX ------------------------------- */

/** Maskiert XML-Sonderzeichen und entfernt in XML unzulässige Steuerzeichen. */
function xmlText(wert: string): string {
  return wert
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Spaltenname zu einem Index: 0 → A, 26 → AA. */
function spalte(index: number): string {
  let name = '';
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

/** Blattnamen auf die von Excel erlaubte Form bringen. */
function blattName(name: string, index: number): string {
  const sauber = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return sauber || `Tabelle${index + 1}`;
}

function blattXml(blatt: Blatt): string {
  const zeilen = blatt.zeilen
    .map((zeile, r) => {
      const zellen = zeile
        .map((wert, c) => {
          const ref = `${spalte(c)}${r + 1}`;
          const stil = r === 0 ? ' s="1"' : '';
          if (wert === null || wert === undefined || wert === '') return `<c r="${ref}"${stil}/>`;
          if (typeof wert === 'number' && Number.isFinite(wert)) {
            return `<c r="${ref}"${stil}><v>${wert}</v></c>`;
          }
          return `<c r="${ref}"${stil} t="inlineStr"><is><t xml:space="preserve">${xmlText(String(wert))}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${zellen}</row>`;
    })
    .join('');

  const spaltenzahl = Math.max(...blatt.zeilen.map((z) => z.length), 1);
  const breiten = Array.from({ length: spaltenzahl }, (_, c) => {
    const laenge = Math.max(...blatt.zeilen.map((z) => String(z[c] ?? '').length), 10);
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, laenge + 3)}" customWidth="1"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${breiten}</cols><sheetData>${zeilen}</sheetData></worksheet>`;
}

/** Erzeugt eine Arbeitsmappe mit einem Blatt je Eintrag. */
export function xlsxErzeugen(blaetter: Blatt[]): Blob {
  const namen = blaetter.map((b, i) => blattName(b.name, i));

  const dateien = [
    {
      name: '[Content_Types].xml',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${blaetter.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
    },
    {
      name: '_rels/.rels',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${namen.map((n, i) => `<sheet name="${xmlText(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${blaetter.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${blaetter.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`,
    },
    ...blaetter.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, inhalt: blattXml(b) })),
  ];

  return schreibeZip(dateien);
}

/** Lädt einen Blob als Datei herunter. */
export function dateiLaden(blob: Blob, dateiname: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

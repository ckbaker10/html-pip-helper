# Prüfstand 2026-10-22

## Version 0.1.3

Paket: `dist/html-pip-helper-0.1.3.xpi`, Kennung
`html-pip-helper@local.invalid`, Lizenz MPL-2.0.
Das Paket wurde temporär auf einem echten Android-Gerät installiert.

## Automatische Prüfungen

15 Firefox-Verhaltenstests bestanden. Sie prüfen:

- PiP-Freigabe vorhandener und verschachtelt eingefügter Videos.
- Entfernen erneut gesetzter `disablepictureinpicture`-Attribute.
- Erhalt des Layouts und pausierter Wiedergabe bei der Freigabe.
- Schutz erst nach tatsächlichem Wiedergabestart, auch in eingebetteten Frames.
- Nutzerpause und vorhandene Vollbild-Steuerelemente.
- Wiederherstellung nach vertrauenswürdigen Browser-Decodierungsfehlern.
- Wiederherstellung der vorherigen Wiedergabeposition.
- Bestehende Fehler beim Eintritt ins Vollbild.
- Respektieren eigener erfolgreicher Player-Wiederherstellung.
- Ausschluss mehrteiliger Playlists und Begrenzung auf zwei Versuche pro Minute.

Die Decodierungsfehler entstehen über `MediaSource.endOfStream("decode")`.
Der Test für den nativen Wiederherstellungsweg verwendet zusätzlich einen
ausdrücklich simulierten HTTP-Quellenadapter. Der native Neustart selbst wurde
auch an einem echten direkt geladenen Video geprüft.

`web-ext lint` meldete null Fehler, Warnungen und Hinweise; der XPI-Build
war erfolgreich. Werkzeuge: Node.js 22.20.0, Playwright 1.64.1, web-ext 10.8.0.
Nachweis: `work/evidence/pip-unlock-native-final-checks-2/`, Exit 0,
21.644 Hostsekunden.

## Prüfungen am echten Gerät

Android 16, Firefox Android 158.0.2, aktiver Inhaltsblocker, ADB 37.0.1.
Browserprofil und Appdaten wurden bei diesen Prüfungen nicht zurückgesetzt.

Bei unterschiedlichen HTML5-Playern wurde ein schwarzes PiP mit
`MEDIA_ERR_DECODE` beobachtet. Je nach Player blieb eine direkte Quelle mit
steigenden verworfenen Bildzahlen erhalten, oder der Player entfernte nach dem
Fehler seine Medienverbindung. Ein weiterer Player stellte seinen Stream selbst
wieder her. Diese Fälle wurden getrennt bewertet.

Der gezielte Neustart einer direkten Videoquelle stellte Bild und Position
ohne Neuladen der ganzen Seite wieder her. Im abschließenden Lauf mit Version
0.1.3 blieb das PiP nach mehrfach Home und App-Wechseln über 223 Hostsekunden
sichtbar: Videozeit 616.53531 → 839.475685, 1920 × 1080 Pixel, `readyState=4`,
`paused=false`, Bildzähler 1330 → 12474, verworfene Bilder konstant bei 1.
Der Fehler trat in diesem Endlauf nicht erneut auf. Ein automatischer Neustart
war deshalb in diesem Lauf nicht erforderlich und wurde nicht als neu ausgelöst
ausgewiesen.

Eine erneut gesetzte PiP-Sperre wurde am echten Video vor dem Wiedergabestart
entfernt; Inline-Stil und Pausenzustand blieben erhalten.

Die genauen Befehle, Hostzeitstempel, Eingabe-Hashes, Exitstatus und privaten
Geräteaufzeichnungen liegen ausschließlich im ignorierten `work/evidence/`.
Sie werden nicht im Repository veröffentlicht. Laufzeiten beziehen sich auf
die Hostuhr, nicht auf die Gerätezeit.

Hintergrundton bei gesperrtem Bildschirm hängt vom Player und den
Hintergrundregeln des Geräts ab. Der gesperrte Zustand wurde nicht geprüft;
Sperrbildschirm- und Akku-Einstellungen wurden nicht verändert.

## Reproduktion

Aus dem Repository-Verzeichnis mit Node.js 22 oder neuer:

```sh
npm ci
npx playwright install firefox
npm test
npm run lint
npm run build
```

Der Android-Test setzt Appdaten zurück und darf nur auf einem dedizierten
Emulator ausgeführt werden. Gerätekennung und lokale Werkzeugpfade sind
konfigurierbar. Der optionale Live-Test erhält URL und bei Bedarf
Player-Selektoren über Umgebungsvariablen; es sind keine Zielseiten hinterlegt.
Details: [README.md](README.md).

## Geprüfte Erweiterungseingaben

| Eingabe | SHA-256 |
| --- | --- |
| `extension/content.js` | `1c224563a4dd9fb4accb6066816bda40bf1ad076f0acef275c8734ccbcf252fe` |
| `extension/manifest.json` | `a029ad53966b2117b5bae41eb451831bbea73656d31c63e0ecfad81f971f1e94` |
| `dist/html-pip-helper-0.1.3.xpi` | `978e4d97c201813d2d4a38b470e563dba147ea60e9a0779827de64126baf5918` |

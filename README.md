# HTML PiP Helper

Kleine Firefox-Erweiterung für Android. Unterstützt laufende HTML5-Videos auch in
eingebetteten Playern anderer Domains, ohne zusätzliche Buttons einzublenden.

## Benutzung

1. Videoseite öffnen und Wiedergabe im Player starten.
2. Über den vorhandenen Vollbildknopf des Players das Video im Vollbild öffnen.
3. Android-Home drücken oder zum Startbildschirm wischen. Das Video läuft im
   nativen schwebenden Android-Fenster weiter.

Firefox muss in Android unter „Spezieller App-Zugriff → Bild-in-Bild“ erlaubt sein.
Ein laufendes Video ist erforderlich. Für den beobachteten Decodierungsfehler
nach schnellen Home-Wechseln enthält das Add-on eine begrenzte Wiederherstellung.
Gesperrte Videos, andere Playerfehler oder ein fehlendes `allowfullscreen` im
einbettenden Frame werden dadurch nicht behoben.
Die vorhandenen Player- und Browser-Steuerelemente bleiben für PiP zuständig.

## Bauen und lokal testen

Voraussetzungen: Node.js 22+, npm, für Verhaltenstests FFmpeg und Playwright Firefox.

```sh
npm ci
npx playwright install firefox
npm run lint
npm test
npm run build
```

Paket: `dist/html-pip-helper-0.1.3.xpi`.

Die XPI ist **unsigniert**. Für eine normale dauerhafte Installation in Firefox
muss sie von Mozilla signiert werden, auch bei privater Verteilung außerhalb des
Add-on-Katalogs. In dieser Projektphase wird nichts veröffentlicht und kein
Mozilla-Konto benötigt. Für Entwicklung ist temporäres Laden per `web-ext`
vorgesehen:

```sh
export PATH="/pfad/zum/android-sdk/platform-tools:$PATH"
npx web-ext run --source-dir extension --target firefox-android \
  --adb-device emulator-5554 --firefox-apk org.mozilla.firefox
```

In Firefox dazu „Einstellungen → Erweitert → Fern-Debugging über USB“ aktivieren.
Temporäre Erweiterungen verschwinden beim Browserneustart. Private Fenster müssen
bei Bedarf separat für die Erweiterung freigegeben werden.

## Ohne ADB auf dem eigenen Android installieren

Für den normalen Firefox zuerst die XPI privat von Mozilla signieren lassen:

1. Im [Mozilla Developer Hub](https://addons.mozilla.org/de/developers/addon/submit/distribution)
   mit einem Mozilla-Konto anmelden und ein neues Add-on einreichen.
2. **On your own / selbst verteilen** wählen. Die Erweiterung wird dadurch nicht
   öffentlich im Add-on-Katalog angeboten.
3. `dist/html-pip-helper-0.1.3.xpi` hochladen, Android-Kompatibilität auswählen
   und die Einreichung abschließen. Der enthaltene JavaScript-Code ist lesbar;
   er wurde weder minimiert noch aus anderen Quellen kompiliert.
4. Nach der Prüfung die **signierte** XPI herunterladen. Mozilla nennt bis zu
   24 Stunden, bei manueller Prüfung kann es länger dauern.
5. Die signierte XPI auf dem Android-Gerät speichern.
6. In Firefox **Einstellungen → Über Firefox** öffnen und das Firefox-Logo
   fünfmal schnell antippen.
7. Zurück zu **Einstellungen → Erweiterung aus Datei installieren** gehen,
   die signierte XPI auswählen und die Installation bestätigen.

Eine Git-Hosting-Plattform wird dafür nicht benötigt. Dieses Projekt wurde
noch nicht bei Mozilla eingereicht; die lokale XPI ist weiterhin unsigniert.
Eine neue Version muss erneut signiert werden. Automatische Updates sind in
dieser ersten Version nicht konfiguriert.

Quellen: [Einreichen](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/),
[Signieren](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/),
[Installation auf Android](https://extensionworkshop.com/documentation/publish/install-self-distributed/).

## Android-Emulatortest

Der vorhandene Audiobook-Emulator `AudiobookStack_Functional_API34` wird benutzt.
`scripts/android-test.mjs` setzt Firefox Android, ADB und geckodriver voraus und
verwendet ein **nach dem Test gelöschtes Browserprofil**. Geckodriver setzt beim
Start die Firefox-Appdaten auf dem Testemulator zurück. Deshalb ausschließlich
auf einem dedizierten Emulator ohne persönliche Firefox-Daten ausführen.
Keine anderen Tests gleichzeitig auf demselben Emulator starten.

Lokale Testeingaben (ignoriert, nicht im Repository):

- `work/firefox.apk`: Firefox Android 158.0.2, x86_64, von Mozillas Release-Server.
- `work/geckodriver`: geckodriver 0.37.1 aus dem offiziellen GitHub-Release.
- `work/ublock.xpi`: signiertes uBlock Origin 1.75.0 von addons.mozilla.org.

```sh
npm run build
export PATH="/pfad/zum/android-sdk/platform-tools:$PATH"
export ADB="/pfad/zum/android-sdk/platform-tools/adb"
export GECKODRIVER="$PWD/work/geckodriver"
export ANDROID_SERIAL=emulator-5554
npm run test:android
```

Der Test installiert uBlock Origin und dieses Add-on, schließt die nativen
Installationsbestätigungen und prüft einen extern eingebetteten lokalen Testclip.
Er verlangt einen Firefox-Task mit `mode=pinned` **und** fortschreitende Videozeit
bei `paused=false`. Mit `ANDROID_LIVE_TEST=1` und `ANDROID_LIVE_URL` prüft er danach
zusätzlich eine selbst angegebene Videoseite. Beide Variablen beim Aufruf von
`npm run test:android` setzen. Optional legen `ANDROID_LIVE_FRAME`,
`ANDROID_LIVE_PLAY` und `ANDROID_LIVE_FULLSCREEN` die CSS-Selektoren für einen
einbettenden Frame sowie Wiedergabe- und Vollbildknöpfe fest. Ohne diese Optionen
wird ein Video im Hauptdokument über das Videoelement bedient.
Zusätzliche Tabs werden geschlossen, uBlock wird dafür nicht abgeschaltet.
Die Live-Prüfung hängt von der Erreichbarkeit und Bedienbarkeit des Players ab.

Testdaten, Screenshots, Protokolle und SHA-256-Nachweise liegen ausschließlich in
`work/`. Details zu den verifizierten Ergebnissen: [TESTING.md](TESTING.md).

## Berechtigungen und Grenzen

Die Erweiterung läuft in HTTP-/HTTPS-Seiten und allen Frames. Die breite
Seitenauswahl ist nötig, weil Webseiten Videos auf wechselnden externen
Hosterdomains einbetten. Die Erweiterung blendet keine eigenen Steuerelemente ein
und enthält keine Netzwerkzugriffe, Telemetrie oder Datensammlung.
Sie speichert keine Video-URLs und extrahiert keine Streams.

PiP-Sperren über `disablepictureinpicture` werden bereits vor dem Videostart
entfernt. Das gilt auch für später eingefügte Videos, verschachtelte Player und
erneut gesetzte Sperrattribute. Position, Breite und sonstiges Videolayout werden
dabei nicht verändert; pausierte Videos werden dadurch nicht gestartet.

Beim Start eines Videos wird im betreffenden Dokument die Page Visibility API auf
„sichtbar“ gehalten und `visibilitychange` abgefangen. Das verhindert verbreitete
Hintergrund-Pausen. Absichtliches Pausieren bleibt möglich. Ein Neuladen setzt
diesen Schutz zurück. Andere Pause-Mechanismen eines Hosters werden nicht
pauschal überschrieben.

Meldet ein zuvor laufendes Video im Vollbild `MEDIA_ERR_DECODE`, lädt die
Erweiterung bei JW Playern mit genau einem Playlist-Eintrag diesen Eintrag über
die vorhandene Player-API neu. Direkt über HTTP geladene, unverschlüsselte Videos
können stattdessen über ihre native Ladefunktion wiederhergestellt werden.
Nach dem ersten wiedergegebenen Bild stellt sie
die letzte Position wieder her. Das kann eine kurze Bildunterbrechung verursachen;
ein Neuladen der ganzen Seite ist dafür nicht nötig. Die Erweiterung untersucht
keine Medieninhalte und protokolliert oder speichert keine Stream-Adressen.
Mehrteilige JW-Playlists und
MediaSource-Player ohne unterstützte Player-API werden nicht neu geladen.
Hat ein Player seine Wiedergabe bereits selbst wiederhergestellt, unterbleibt
ein zusätzlicher Neustart durch die Erweiterung.
Ein bereits bestehender Decodierungsfehler wird auch beim Eintritt ins Vollbild
geprüft, damit ein zuvor ausgefallenes Video dort wieder anlaufen kann.

Es gibt höchstens zwei Wiederherstellungsversuche innerhalb von 60 Sekunden.
Eine Nutzerpause, Entfernen des Videos oder Verlassen des Vollbilds vor dem
Wiederanlauf verhindert den Versuch. Eine Pause während des Ladens wird ebenfalls
respektiert. Bei weiteren Fehlern oder ausbleibender Wiedergabe wird nicht
unbegrenzt neu gestartet.

Das schwebende Fenster erzeugt Firefox zusammen mit Android. Ein Browser-Add-on
kann den Android-Home-Schritt nicht selbst auslösen. Geschlossene Shadow-DOM-
Player und reine Canvas-/DRM-Sonderplayer sind nicht unterstützt.

Bei ausgeschaltetem oder gesperrtem Bildschirm kann die Tonwiedergabe im
Hintergrund fortgesetzt werden. Ob sie weiterläuft, hängt auch vom Player und
Androids Akku- und Hintergrundbeschränkungen ab. Das PiP-Bild ist dabei nicht
sichtbar. Das Verhalten bei gesperrtem Bildschirm wurde auf dem Testgerät noch
nicht geprüft; die Erweiterung ändert keine Sperrbildschirm- oder Akkueinstellungen.

## Referenzen und Lizenz

- Technische Referenz: [mozilla/video-bg-play](https://github.com/mozilla/video-bg-play).
  Eigenständige Implementierung, kein Fork und keine Mozilla-Zugehörigkeit.
- Vergleich zur PiP-Freigabe: [Enable Picture-in-Picture](https://addons.mozilla.org/de/firefox/addon/enable-picture-in-picture/).
  Die Freigabe hier verändert weder Videobreite noch CSS-Position.
- [Mozilla: Videos und Bild-in-Bild auf Android](https://support.mozilla.org/en-US/kb/playing-videos-firefox-android)
- [Mozilla: Android-Erweiterungen entwickeln](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- [Mozilla: Signierung und Verteilung](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

MPL-2.0, siehe [LICENSE](LICENSE).

import http from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

mkdirSync("work", { recursive: true });
if (!existsSync("work/test.webm")) {
  execFileSync(process.env.FFMPEG || "ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "30",
    "-c:v", "libvpx", "-b:v", "300k", "-c:a", "libopus", "-y", "work/test.webm"
  ]);
}
const clip = readFileSync("work/test.webm");
const port = Number(process.env.FIXTURE_PORT || 8765);
export const server = http.createServer((request, response) => {
  if (request.url === "/test.webm") {
    const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || "");
    const start = match ? Number(match[1]) : 0;
    const end = match && match[2] ? Math.min(Number(match[2]), clip.length - 1) : clip.length - 1;
    if (start >= clip.length || end < start) {
      response.writeHead(416, { "Content-Range": `bytes */${clip.length}` }).end();
      return;
    }
    response.writeHead(match ? 206 : 200, {
      "Content-Type": "video/webm", "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      ...(match ? { "Content-Range": `bytes ${start}-${end}/${clip.length}` } : {})
    });
    response.end(clip.subarray(start, end + 1));
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  const embedded = request.url === "/embedded";
  const empty = request.url === "/empty";
  response.end(`<!doctype html><html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>PiP Prüfvideoplayer</title><style>body{margin:16px;background:#101720;color:white;font:18px sans-serif}
    video,iframe{display:block;width:100%;height:240px;border:0}button{padding:16px}</style>
    <h1>PiP Prüfvideoplayer</h1><p>Lokales Testbild mit synthetischem Ton.</p>
    ${embedded ? `<iframe title="Externer Player" src="http://localhost:${port}/player" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` :
      empty ? '<div id="container"></div>' : '<video controls loop playsinline src="/test.webm"></video><button id="fullscreen" onclick="const v=document.querySelector(\'video\');v.play();v.requestFullscreen()">Vollbild</button>'}
    <p>Video starten, im Player Vollbild öffnen, dann Android-Home drücken.</p></html>`);
});
server.listen(port, "127.0.0.1", () => console.log(`Fixture server: http://127.0.0.1:${port}`));

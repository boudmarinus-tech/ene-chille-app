import * as cheerio from "cheerio";

export async function handler() {
  try {
    const url = "https://www.lzvcup.be/teams/overview/461";

    const res = await fetch(url, {
      headers: {
        "User-Agent": "ENE-CHILLE/1.0 (+https://example.net)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // -------- HEADERS ----------
    const headerCols = $("#stand .item-list .item-list-header .item-row .item-col");

    const pickHeaderText = (col) => {
      const candidates = $(col)
        .find("div")
        .map((_, d) => $(d).text().trim())
        .get()
        .filter((t) => t && t !== "#");
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        return candidates[0];
      }
      return $(col).text().replace(/\s+/g, " ").trim();
    };

    let headers = [];
    if (headerCols.length > 0) {
      const firstCol = headerCols.first();
      const posLabel  = firstCol.find(".col-2").text().trim() || "Pos";
      const teamLabel = firstCol.find(".col-10").text().trim() || "Ploeg";
      headers.push(posLabel, teamLabel);

      headerCols.slice(1).each((_, col) => {
        headers.push(pickHeaderText(col));
      });
    } else {
      headers = ["Pos","Ploeg","Gespeeld","Gewonnen","Gelijk","Verloren","DG","DT","DS","Punten","Ptn/M"];
    }

    // ❶ Verwijder Ptn/M uit headers (en onthoud index om rijen te knippen)
    const dropIdx = headers.findIndex((h) => /ptn\/?m/i.test(h));
    if (dropIdx >= 0) headers.splice(dropIdx, 1);

    // -------- RIJEN ----------
    const rows = [];
    // ❷ Sluit header-item expliciet uit
    $("#stand .item-list li.item").not(".item-list-header").each((_, li) => {
      const cols = $(li).find(".item-row .item-col");
      if (cols.length === 0) return;

      const first = cols.first();
      const pos   = first.find(".col-2").text().replace(/\s+/g, " ").trim();
      const ploeg = first.find(".col-10").text().replace(/\s+/g, " ").trim();

      const rest = cols
        .slice(1)
        .map((__, c) => $(c).text().replace(/\s+/g, " ").trim())
        .get();

      let row = [pos, ploeg, ...rest];

      // ❸ Knip de kolom Ptn/M ook uit de rijen
      if (dropIdx >= 0) {
        // dropIdx geldt in headers; row kan evenveel of 1 minder cellen hebben
        // (omdat eerste kolom in 2 deelkolommen splitst). Safe aanpak:
        // Map header-index naar row-index:
        // headers: [Pos,Ploeg, ...]
        // row:     [Pos,Ploeg, ...]
        // dus zelfde index.
        row.splice(dropIdx, 1);
      }

      rows.push(row);
    });

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ headers, rows, source: url }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
}

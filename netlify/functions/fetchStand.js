// netlify/functions/fetchStand.js
import * as cheerio from "cheerio";

export async function handler() {
  try {
    const url = "https://www.lzvcup.be/teams/overview/461";
    const res = await fetch(url, { headers: { "User-Agent": "ENE-CHILLE-App/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const $ = cheerio.load(html);

    const table = $("table").first();

    const headers = table.find("thead th").map((_, th) => $(th).text().trim()).get();

    const rows = table.find("tbody tr").map((_, tr) => {
      const cells = $(tr).find("td").map((_, td) => $(td).text().trim()).get();
      return cells;
    }).get();

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ headers, rows }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
}

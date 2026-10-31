import { describe, expect, it } from 'vitest';

import { decodeEntities, wikiHtmlToText } from '../../src/rag/html-to-text';

describe('wikiHtmlToText', () => {
  it('рядок таблиці стає «клітинка | клітинка»', () => {
    const html =
      '<table class="wikitable"><tbody><tr>\n<th>PID</th>\n<th>Description\n</th></tr>\n' +
      '<tr><td align="center"><span class="monospaced">05</span></td><td>Engine coolant temperature\n</td></tr></tbody></table>';
    expect(wikiHtmlToText(html)).toBe('PID | Description\n05 | Engine coolant temperature');
  });

  it('<link> усередині абзацу — не пункт списку', () => {
    const html = '<p>Response is <link rel="mw-deduplicated-inline-style" href="x" /><span>BE1FA813</span>, decoded:</p>';
    expect(wikiHtmlToText(html)).toBe('Response is BE1FA813, decoded:');
  });

  it('прибирає службові плашки редакторів', () => {
    const html =
      '<table class="box-More_citations_needed plainlinks metadata ambox"><tbody><tr><td>This section needs more citations.</td></tr></tbody></table><p>Body</p>';
    expect(wikiHtmlToText(html)).toBe('Body');
  });

  it('заголовки зберігає з рівнем, виноски прибирає', () => {
    const html =
      '<div class="mw-heading mw-heading2"><h2 id="History">History</h2></div>' +
      '<p>Introduced in 1996.<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">[1]</a></sup></p>';
    expect(wikiHtmlToText(html)).toBe('## History\n\nIntroduced in 1996.');
  });

  it('відрізає службові розділи з кінця', () => {
    const html = '<p>Body</p><div class="mw-heading"><h2 id="See_also">See also</h2></div><ul><li>Other</li></ul>';
    expect(wikiHtmlToText(html)).toBe('Body');
  });

  it('формулу замінює її TeX-текстом', () => {
    const html = '<p>Ratio <span><math alttext="{\\displaystyle \\lambda =1}"><mi>λ</mi></math><img alt="x"></span>.</p>';
    expect(wikiHtmlToText(html)).toContain('{\\displaystyle \\lambda =1}');
    expect(wikiHtmlToText(html)).not.toContain('<mi>');
  });

  it('прибирає стилі й розкодовує сутності', () => {
    expect(wikiHtmlToText('<style>.a{b:c}</style><p>A &amp; B&nbsp;&#8211; C</p>')).toBe('A & B – C');
    expect(decodeEntities('&#x41;&lt;')).toBe('A<');
  });
});

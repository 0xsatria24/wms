# Export presentation refinement

User request: replace the raw technical appearance of PDF and Excel exports with usable operational documents. Routine design choices are delegated by the user; preserve the existing export scope and source facts.

Design: Clear Operations colors, A4 PDF, compact business header, item/quantity table, complete references and notes below, signatures only when supplied by the source, page number and export ID footer. Suppress empty presentation fields; retain all populated audit facts. Long references wrap in full. Repeat table headings on page breaks and keep ordinary rows together.

Excel: Data opens first, compact title/context above a filtered table, styled headers and alternating rows, semantic column widths, frozen headings, numeric formats without losing text identifiers or precision, print titles and landscape printing for wide tables. Metadata remains a separate audit sheet. CSV contracts stay unchanged.

Plan:
1. Add regression expectations for workbook opening view, types, styling and print setup; generate representative PDF fixtures for visual verification.
2. Refine the existing C# file writer; increment the presentation template version. Do not change inventory commands, authorization, review policy or export evidence.
3. Run writer/export checks, parse files independently, render receipt/count/packing/multipage PDFs and inspect them. Verify an actual download against the rebuilt local API if feasible.

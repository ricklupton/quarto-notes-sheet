# Notes sheet

This Quarto extension gives a reveal.js deck a **notes view**: each slide's
notes beside a small picture of the slide, in a printable layout.

Section slides become headings. Slides with no notes can be packed onto the same
row to save space.

## Installing

```bash
quarto add ricklupton/quarto-notes-sheet
```

This installs the extension under `_extensions/`. If you use version control,
check that directory in.

## Using

Add the plugin to the deck:

```yaml
revealjs-plugins:
  - notes-sheet
```

The deck shows its slides as usual. There are several ways to open the notes
view:

- **the `T` key** (press it again to go back to the slides);
- **"Notes view"** in the Tools section of the menu;
- **`?view=notes` on the URL**, e.g. `talk.html?view=notes`;

You might want to make the view dicoverable, such as via a link in the footer:

```yaml
footer: "My talk · [Notes view](?view=notes)"
```

To print, use the browser's print command.

### Output that opens directly in notes view

Set `notes-sheet: true`, for example in a
[project profile](https://quarto.org/docs/projects/profiles.html), to render
a separate file that opens straight in the notes view:

```yaml
# _quarto-notes.yml, used by: quarto render talk.qmd --profile notes
project:
  output-dir: _notes
notes-sheet: true
```

`?view=slides` on such a file shows the slides instead.

### Options

The following options can be customised.

```yaml
notes-sheet:
  enabled: false          # default true: open in the notes view
  thumbnail-width: 8cm    # default 5.4cm
  notes: right            # right or below
  strips: false           # wrap slides without notes onto one row
  paper: A4               # any CSS page size, e.g. letter
  key: T                  # the key that switches views
```

## How it works

In the notes view, the plugin starts reveal.js in its
[print view](https://revealjs.com/pdf-export/). That view lays every slide
out at full size, with all its fragments showing. Once reveal reports that
the layout is ready (`pdf-ready`), the plugin moves each slide into a small
frame beside that slide's notes, and hides the deck.

Each thumbnail keeps its own `.reveal .slides` wrapper, so the deck's theme
still applies to it. The notes sit outside the `.reveal` wrapper, so they are
styled as text rather than as slide content. The plugin's stylesheet applies
only in the notes view, so it does not affect the slides or reveal's own PDF
export.

Notes:

- **reveal.js internals.** The plugin relies on how reveal.js's print view
  builds and sizes its pages. A future reveal.js could break it. If that
  happens, the notes view stays blank. The plugin needs reveal.js 5, which
  Quarto has bundled since version 1.5. It has been tested with Quarto 1.8.
- **Live slides.** Thumbnails are live slides, so videos, iframes and
  interactive widgets load in the notes view too.
- **Footers and logos** are not shown in the thumbnails.
- **Browsers.** Scaling uses CSS `zoom`, which needs Firefox 126 or later.
  Chrome, Edge and Safari support it.

## Example

`example.qmd` is a short deck. Render it, open `example.html`, and press `T`.

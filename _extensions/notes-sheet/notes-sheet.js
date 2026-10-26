/*
  notes-sheet: a reveal.js plugin that turns a deck into a page of speaker
  notes, each slide's notes beside a small picture of the slide, to read on
  screen or print.

  The deck shows its slides as usual until the notes view is asked for:

    * by a key (T, unless `key` says otherwise) or the "Notes view" entry in
      Quarto's Tools menu, which reload the deck with `?view=notes` on its
      URL -- and the same key goes back to the slides;
    * by `?view=notes` on the URL directly, like Quarto's `?view=print`, or
      a link to it in the deck, e.g. `[Notes view](?view=notes)`; or
    * by `notes-sheet: true` in the document or a profile, which makes a
      deck that opens in the notes view.  (`?view=slides` overrides it.)

  Not `?notes...`: reveal's speaker notes plugin opens its speaker view for
  any URL whose query starts with "notes".

  `notes-sheet` can also be a map of options -- see `options` below.

  In the notes view it starts reveal.js in its print view, which does the
  hard part: it puts every slide on its own page at full size, with all its
  fragments showing and its stretched figures sized, and announces
  `pdf-ready` when that is done.  This then takes those pages and puts each
  one, scaled down, beside the slide's notes:

    * each Quarto section slide (`# Heading`) becomes a heading on the sheet,
    * a slide with notes gets a row: thumbnail, then the notes, and
    * a run of slides without notes is packed into one strip of thumbnails.

  So the thumbnails are the slides themselves, not pictures of them, and they
  can never drift away from the notes they belong to.

  Each thumbnail is wrapped in a `.reveal .slides` of its own so the deck's
  theme still applies to it, while the notes text sits outside any `.reveal`
  and so is not styled as slide content.  The deck itself is then hidden.

  It relies on parts of reveal.js's print view (the `pdf-page` elements and
  how they are sized), so a new reveal.js could break it.  If it does, the
  sheet is simply never built: the page stays blank.
*/

window.RevealNotesSheet = function () {
  "use strict";

  // The slide the deck was opened at (the URL's #/...), kept before reveal's
  // print view resets it, so the notes view can open there and the slides
  // can come back to it.
  var startHash = window.location.hash;

  // The settings, from `notes-sheet:` in the document.  It may be true or
  // false, or a map of options, which turns the notes view on unless it has
  // `enabled: false` -- so a deck can set how its notes view looks without
  // opening in it.
  function options(deck) {
    var value = deck.getConfig()["notes-sheet"];
    var given = value && typeof value === "object" ? value : {};
    return {
      enabled: given === value ? given.enabled !== false : !!value,
      // Any CSS page size: "A4", "letter", "A4 landscape", ...
      paper: given.paper || "A4",
      // The width of each slide picture, as a CSS length.
      thumbnailWidth: given["thumbnail-width"] || "5.4cm",
      // Where a slide's notes go: "right" of the picture, or "below" it.
      notes: given.notes === "below" ? "below" : "right",
      // Pack runs of slides without notes into strips, or give each its own
      // row (leaving room to write beside it on a printout).
      strips: given.strips !== false,
      key: String(given.key || "T").toUpperCase(),
    };
  }

  // Whether the URL asks for the notes view (true), for another view such
  // as the slides (false), or says nothing (null).  Quarto's own
  // `?view=print` is the print view as reveal makes it, not this.
  function fromUrl() {
    var view = new URLSearchParams(window.location.search).get("view");
    if (!view || view === "print") return null;
    return view === "notes";
  }

  // Reload the deck in the other view, keeping its place.
  function toggle(opts, active) {
    var url = new URL(window.location.href);
    var params = url.searchParams;
    params.delete("view");
    params.delete("print-pdf");
    if (active ? opts.enabled : !opts.enabled) {
      params.set("view", active ? "slides" : "notes");
    }
    url.search = params.toString();
    if (active) url.hash = startHash;
    window.location.href = url.toString();
  }

  // The key, in either view.  The slides use reveal's own key bindings, so
  // it shows in the keyboard help; the print view turns those off, so the
  // notes view listens for itself.
  function bindKey(deck, opts, active) {
    var code = opts.key.charCodeAt(0);
    var go = function () { toggle(opts, active); };
    if (!active) {
      deck.addKeyBinding({ keyCode: code, key: opts.key,
        description: "Notes view" }, go);
      return;
    }
    window.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (/input|textarea|select/i.test(e.target.nodeName)) return;
      if (e.keyCode === code) {
        e.preventDefault();
        go();
      }
    });
  }

  // An entry in the Tools list of Quarto's menu, beside its own "PDF Export
  // Mode".  Quarto builds that list itself, so if it isn't there (another
  // format, or the menu turned off) there is simply no entry.
  function addMenuEntry(deck, opts) {
    var list = document.querySelector(".slide-menu-custom-panel .slide-menu-items");
    if (!list || list.querySelector(".ns-menu-item")) return;
    var item = el("li", "slide-tool-item ns-menu-item");
    item.setAttribute("data-item", String(list.children.length));
    var link = el("a");
    link.href = "#";
    link.appendChild(el("kbd", null, opts.key.toLowerCase()));
    link.appendChild(document.createTextNode(" Notes view"));
    link.addEventListener("click", function (e) {
      e.preventDefault();
      toggle(opts, false);
    });
    item.appendChild(link);
    list.appendChild(item);
  }

  // A link to `?view=notes` in the deck (in a footer, say) works as it is,
  // but loses the deck's place; this sends it through `toggle` instead.
  function catchLinks(opts) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.getAttribute("href") !== "?view=notes") return;
      e.preventDefault();
      e.stopPropagation();
      toggle(opts, false);
    }, true);
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  function textOf(root, selector) {
    return Array.prototype.map.call(root.querySelectorAll(selector),
      function (e) { return e.textContent.trim(); }).join(", ");
  }

  function build(deck, opts) {
    var config = deck.getConfig();
    var root = deck.getRevealElement();

    // Each page is the slide with a margin round it, as on the screen.  This
    // is how reveal's print view sizes them.
    var w = Math.floor(config.width * (1 + config.margin));
    var h = Math.floor(config.height * (1 + config.margin));

    var sheet = el("main", "ns-sheet ns-notes-" + opts.notes);
    var pending = [];   // slides with nothing to say, waiting for a strip
    var frames = [];
    var places = {};    // where each slide ended up, by id and number

    // A thumbnail of one print-view page.
    function thumb(page) {
      var frame = el("div", "ns-thumb");
      frame.style.aspectRatio = w + " / " + h;
      var scale = el("div", "ns-scale");
      scale.style.width = w + "px";
      scale.style.height = h + "px";
      var reveal = el("div", "reveal ns-slide");
      var slides = el("div", "slides");
      page.style.width = w + "px";
      page.style.height = h + "px";
      slides.appendChild(page);
      reveal.appendChild(slides);
      scale.appendChild(reveal);
      frame.appendChild(scale);
      frames.push(scale);
      return frame;
    }

    function flushPending() {
      if (!pending.length) return;
      var strip = el("div", "ns-strip");
      strip.appendChild(el("div", "ns-number", String(pending[0].n)));
      pending.forEach(function (s) {
        strip.appendChild(thumb(s.page));
        places[s.id] = places[s.n] = strip;
      });
      sheet.appendChild(strip);
      pending = [];
    }

    // Title block: the deck's title, then a quiet line saying what this is,
    // who for and when it was built, so an old printout can be told from a
    // current one.  For a local file, lastModified is when it was built.
    var titleSlide = document.getElementById("title-slide") || root;
    var title = textOf(titleSlide, ".title") || document.title;
    var built = new Date(document.lastModified).toLocaleDateString(undefined, {
      day: "numeric", month: "long", year: "numeric",
    });
    var block = el("header", "ns-title");
    block.appendChild(el("h1", null, title));
    block.appendChild(el("p", null, ["Notes",
      textOf(titleSlide, ".subtitle"),
      textOf(titleSlide, ".quarto-title-author-name"),
      built].filter(Boolean).join(" · ")));
    sheet.appendChild(block);
    document.title = title + " · notes";

    var pages = Array.prototype.slice.call(
      root.querySelectorAll(".slides .pdf-page"));
    pages.forEach(function (page, i) {
      var section = page.querySelector("section");
      if (!section) return;
      var n = i + 1;
      var level1 = section.classList.contains("level1");

      // From `<aside class="notes">` or a `data-notes` attribute.
      var body = el("div", "ns-notes");
      body.innerHTML = deck.getSlideNotes(section) || "";
      var hasNotes = body.textContent.trim() || body.querySelector("img");

      if (level1) {
        flushPending();
        var heading = section.querySelector("h1, h2");
        var h2 = el("h2", "ns-heading", heading && heading.textContent.trim());
        sheet.appendChild(h2);
        places[section.id] = places[n] = h2;
        if (!hasNotes) return;
      }
      if (hasNotes || !opts.strips) {
        flushPending();
        var row = el("div", "ns-row");
        row.appendChild(el("div", "ns-number", String(n)));
        row.appendChild(thumb(page));
        row.appendChild(body);
        sheet.appendChild(row);
        places[section.id] = places[n] = row;
      } else {
        pending.push({ n: n, id: section.id, page: page });
      }
    });
    flushPending();

    // Added now, not at start-up, so it comes after (and so overrides) the
    // page size reveal sets for its print view.  The left margin is mostly
    // the sheet's own padding, because a browser will not print anything
    // placed in the page margin itself: the slide numbers hang there.
    var style = el("style");
    style.textContent = "@page { size: " + opts.paper +
      "; margin: 1.6cm 1.8cm 1.6cm 0.6cm; }";
    document.head.appendChild(style);

    document.documentElement.style.setProperty("--ns-thumb-w", opts.thumbnailWidth);
    document.body.removeAttribute("style");
    document.body.appendChild(sheet);
    document.documentElement.classList.add("ns-built");

    // Scale each slide to its frame, now that the frames have a size.
    frames.forEach(function (scale) {
      scale.style.zoom = scale.parentNode.clientWidth / w;
    });

    // Open at the slide the deck was on, once the fonts are in and the
    // sheet has its final layout.
    var at = decodeURIComponent(startHash.replace(/^#\/?/, "")).split("/")[0];
    if (at && places[at]) {
      document.fonts.ready.then(function () {
        window.requestAnimationFrame(function () { places[at].scrollIntoView(); });
      });
    }
  }

  return {
    id: "notes-sheet",

    // Plugins are started before reveal.js chooses its view, so this can
    // still ask for the print view.
    init: function (deck) {
      var opts = options(deck);
      var url = fromUrl();
      var active = url === null ? opts.enabled : url;
      bindKey(deck, opts, active);
      if (!active) {
        catchLinks(opts);
        deck.on("ready", function () { addMenuEntry(deck, opts); });
        return;
      }
      var config = deck.getConfig();
      config.view = "print";
      // A slide whose content overflows its page would otherwise run on to
      // a second page, which the thumbnail would cut off anyway.
      config.pdfMaxPagesPerSlide = 1;
      // One page per slide, with all its fragments showing.
      config.pdfSeparateFragments = false;
      // Leave the URL alone, so it still names the slide the deck was on.
      config.hash = false;
      config.history = false;
      document.documentElement.classList.add("notes-sheet");
      deck.on("pdf-ready", function () { build(deck, opts); });
    },
  };
};



-------------

Front page: highlights, link to on-line demo and tutorial, list of elements: triVM, triWASM, triASM, ... (maybe some diagram) and links to details
* Tutorial
* triVM - highligts
  * Embedding details
  * C API
    * configuration
  * Virtual Machine Architecture
* triConf - highligts with link to triVM configuration and online configurator
  * GUI description
  * Command line description
* triWASM - highligts
  * Architecture description and how it maps to WASM
  * Extensions to use with C with link to assembly syntax
  * Command line options
  * Examples
* triCC - highlights
  * Command line options
  * Examples
* triASM
  * Assembly file syntax
  * Command line arguments
  * Examples
* Tools
  * Online demo - editor + host/guest compiler + running it in a browser
  * Online configurator with optional exporting prepared host and guest sources
* Samples - description, source code and link to online demo if possible
  * C++ Hello World
  * Rust Hello World
  * nRF BLE
  * Compressed archive format
----------------

* Comments on the documentation
  * Comments are kept on GitHub discussions: https://github.com/kildom/triwasm/discussions/categories/documentation-comments
  * Comments are shown and managed by GitHub pages.
  * Unauthorized users will see expandable footer with number of comments. It will be retrieved from category view
    and cached for some time to avoid limit of 60 requests per hour per IP address. After expanding it, all comments will be
    visible.
  * Authorized users will see all comments immediately with option to collapse it.
  * Comments contains version for which it was written and file name if different than the current one.
  * If file was moved, merged, e.t.c. discussion can be moved by changing the title.
  * One page may have multiple discussions attached. One is selected as a main discussion.
  * If file was split, one discussion can be applied to multiple pages. Each item will have
    information on which page it applies to, by default both. New main discussions must be
    created for those pages.
  * Scripts on CI should inform admin about orphaned discussions
  * Admin panel that allows:
    * Show orphan discussions (if empty, allow quick deletion)
    * Show pages without discussion, with quick option to create new empty one
    * Assign discussions to pages
    * Assigning comments from the discussion to specific page
    * Check general consistency
  * Discussion title format:
    * Single page: `/triVM/Architecture/Instructions.html`
    * Single page but not the main: `/triVM/Architecture/Instructions.html #deprecated-332`
      * where `332` is discussion id to make it unique
    * Multiple pages: `/triVM/Architecture/Instructions.html; Extensions.html #deprecated-198`
      * following paths are relative to the previous one
      * discussion with multiple pages cannot be main, so `#deprecated` is always present.
      * Title length limit is 256, so there should be not too much pages, but if it does not
        fit, checksum of full path can be used instead of name, e.g. 12 characters of base64:
        `eAwb+vEDvJbV`. Hash format will be detected base on that entire title will not start
        with the `/` character.
  * Comment tags format:
    * One line at the end of comment after one blank line and horizontal line.
      ```
      End of the comment

      --------------
      `VER: 1.0.3`
      ```
    * `VER: 1.0.3` - show version when it was written (always)
    * `FILE: some-different-file.md` - original file name when it was written (added by admin when moving discussion)
    * `ONLY: only-to-that-file.md` - assigned by the admin when doc page was split and this comment applies just to one of them.
  * On login screen, show user information that he can write comments directly on GitHub without
    logging here, but explain downsides:
    * You have to follow strict rules when writing:
      * Don't create a new discussions, use existing ones
      * Don't add new comments on `#deprecated` discussion (but replying to existing comment is ok)
      * Do not delete tags added by admin or bots
      * (CI should add `VER: ` tag if missing, based on comment date)
    * You will loose filtering on some `#deprecated` discussions.
    * You will loose nice integration


 * Runs entirly on GitHub Actions
 * Tests if automatic downloads works and downloaded content works properly.
 * Tests if external links are available:
    * There should be a database of links
    * Each link has also some expression that checks it e.g. using regex or JS.
      Including HTTP headers to test e.g. content-type.
    * Tests should check if all links from source and docs are in the database.
    * Database entry example:
      ```yaml
      URL: https://bellard.org/quickjs/binary_releases/
      Test: |
        content.match(/quickjs-win-x86_64-[^"]+?\.zip/i)
        && content.match(/quickjs-linux-x86_64-[^"]+?\.zip/i)
        && headers.match(/^Content-type:\s*text/html/mi)
      ```
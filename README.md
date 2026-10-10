# archype-vicinae-ext

[Vicinae](https://vicinae.com) commands for [Archype](https://github.com/ahaltindis/archype), as one extension
(`archype`) installed from the AUR package `archype-vicinae-ext`.

## Commands

### Brave Links

Lists the links in `~/.config/archype/links` with their favicons, grouped by container, and opens the chosen one
in Brave. Open it directly with `vicinae deeplink vicinae://launch/@ahaltindis/archype/links`.

One link per line, `#` starts a comment:

```
# [name]    url                          container   mode
Mail        https://mail.google.com      -           app
            https://github.com           Work
YouTube     youtube.com
Try it      https://example.com          temp
            https://news.ycombinator.com -           window
```

- **name**: optional, may have spaces; without one the menu shows the address. Everything before the first word
  with a `.` or `://` is the name, so a name can't contain those
- **url**: `https://` is added when there's no scheme
- **container**: a Brave container's name (`--container=<name>`, Brave 1.95+), `temp` for a new temporary container
  each time (`--temporary-container`), `-` or nothing for none
- **mode**: `tab` in the current window (default), `window` for a new window, `app` for a borderless web app
  window (`--app`)

Limitations:

- `app` mode ignores the container (and `temp`): Brave only applies `--container` to installed web apps
  (`--app-id`), not to `--app=<url>` windows. This works once Brave supports it.
- Web apps installed from Brave ("Install page as app") don't show up here. They get their own entries in
  vicinae's app search, which open them without a container.

## Development

```
npm install
npm run dev     # builds into ~/.local/share/vicinae/extensions/archype and reloads on changes
```

Stop it with Ctrl+C and remove `~/.local/share/vicinae/extensions/archype` afterwards: vicinae looks there before
`/usr/share/vicinae/extensions`, so a leftover copy hides the installed package. vicinae itself also creates an empty
`archype/assets` there whenever a command runs; without a `package.json` that folder is skipped, so it's harmless.

## Testing the package

```
pkg/test-local
```

Builds the extension, packs it like a release and installs it with `pkg/PKGBUILD` via `makepkg -si`, with the
tarball from the working tree instead of GitHub.

## Releasing

1. Bump `version` in `package.json` and `pkgver` in `pkg/PKGBUILD`, commit.
2. `git tag v<version> && git push --tags`. The release workflow builds the extension and attaches
   `archype-vicinae-ext-<version>.tar.gz` (and its `.sha256`) to a GitHub release.
3. Put the checksum in `pkg/PKGBUILD`, then copy it to the AUR repo with a fresh `.SRCINFO`
   (`makepkg --printsrcinfo > .SRCINFO`) and push.

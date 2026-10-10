# J's Ournal

A private calendar for J. It installs on an iPhone and a PC like a normal app, works offline, updates itself, and keeps both devices in sync.

**How the privacy works:** the calendar is encrypted on each device with J's passphrase before anything leaves it. The encrypted file is kept in a private GitHub repository, which acts only as a relay between the devices. GitHub (and anyone else) sees scrambled data, never the activities. The app uses no Google services, no analytics and no external fonts.

---

## Part 1 — Put the app online (Ibai, once, about 10 minutes)

You need a free GitHub account: <https://github.com/signup>.

1. **Create the app repository.** On GitHub, choose **New repository**. Name it `jsournal`, set it to **Public** (free GitHub Pages needs this; it only holds the app's code, never calendar data) and create it.
2. **Upload the files.** On the new repository's page, choose **uploading an existing file** and drag in everything from this folder.
   The `.github` folder is hidden on most computers. If it doesn't upload, choose **Add file → Create new file**, type the name `.github/workflows/deploy.yml`, paste in the contents of that file from this folder, and commit.
3. **Turn on Pages.** Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. **Check it's live.** Open the **Actions** tab and wait for the **Deploy** run to show a green tick (about a minute). The app is now at:
   `https://YOUR-USERNAME.github.io/jsournal/`

## Part 2 — Make the private sync space (Ibai or J, once)

1. **Create the data repository.** Choose **New repository** again. Name it `jsournal-data`, set it to **Private**, tick **Add a README file**, and create it.
2. **Create an access token** at <https://github.com/settings/personal-access-tokens/new>:
   - **Token name:** `J's Ournal`
   - **Expiration:** the longest option offered
   - **Repository access:** *Only select repositories* → `jsournal-data`
   - **Permissions → Repository permissions → Contents:** *Read and write*
   - Choose **Generate token** and copy it (it starts with `github_pat_`). GitHub shows it only once.

## Part 3 — Install on J's PC

1. Open the app address in **Chrome** or **Edge**.
2. Choose **Install app** (in the app's toolbar, or the install icon at the right of the address bar). It now opens from the Start menu like any program.
3. In the app, open **Devices & sync** and fill in **First-time setup**: your GitHub username, `jsournal-data`, the token, and a passphrase.
   - Pick a passphrase of three or four random words. **Write it down somewhere safe.** Nobody can reset it, and without it the synced copy can't be read.
4. Choose **Start syncing**. The status should read *Synced just now*.

## Part 4 — Install on J's iPhone

1. Open the app address in **Safari** (it must be Safari).
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Open **J's Ournal from the home screen**. Do the next step inside the installed app, not in Safari: they keep separate storage.
4. Go to **Devices & sync** and link it in one of two ways:
   - **Link code:** on the PC, open **Devices & sync → Copy link code**, get it to the phone privately (a note or message to yourself that you delete afterwards), and paste it into **Already set up on another device?**
   - **Or** fill in **First-time setup** again with the same username, repository, token and passphrase. The app recognises the existing calendar and joins it.

Both devices now show the same calendar. Changes sync within a few seconds while the app is open, and whenever it's reopened. Offline changes sync once the device is back online.

---

## Updates

Any change pushed to the `jsournal` repository's `main` branch is published automatically. Installed apps check for a new version when they're opened (and every 30 minutes while open) and refresh themselves. If J is in the middle of something, a small **Update now** message appears instead.

## Backups

- Every sync is saved as a commit in `jsournal-data`, so there's a full history of the encrypted file.
- **Devices & sync → Download backup** saves a readable copy. It is **not** encrypted, so keep it private. **Restore from backup** merges a backup back in.

## What GitHub can see

The encrypted file, its size, when syncs happen, and the type of device that synced (the commit message says "Sync from iPhone" or "Sync from Windows PC"). Not the activities, titles, times, colours or notes.

## When something goes wrong

| What the app says | What to do |
|---|---|
| GitHub didn't accept the access token | The token expired. Make a new one (Part 2, step 2), paste it under **Devices & sync → Access token**, then copy the new link code to the other device. |
| The passphrase doesn't match | Check the passphrase. It's case-sensitive. |
| Can't find the repository | Check the username and repository name, and that the token was given access to `jsournal-data`. |
| The token can't write to this repository | Edit the token on GitHub and set **Contents** to *Read and write*. |
| Offline · will sync later | Nothing. It syncs when the connection returns. |

## How it's built

Plain HTML, CSS and JavaScript with no frameworks or build step.

- `index.html`, `app.css`, `app.js` — the calendar.
- `sync.js` — encryption (AES-256-GCM, key from the passphrase via PBKDF2-SHA256, 310,000 rounds) and the sync logic. When both devices change the same activity, the newest change wins. Deletions are remembered for 180 days so they don't reappear.
- `*.woff2`, `*.png` — bundled fonts and app icons.
- `sw.js` — offline support. It always tries the network first, so new versions load straight away.
- `.github/workflows/deploy.yml` — publishes to GitHub Pages and stamps the version number that triggers updates.

Fonts (Bricolage Grotesque, Atkinson Hyperlegible, JetBrains Mono) are bundled under the SIL Open Font License.

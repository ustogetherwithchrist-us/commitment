# Jemimah & Joel · Together with Christ

**Jemimah Nirmala Chinta weds Joel Raj Vemuri · 16 October 2032**

A small website for the two of us to open every day:

- A **"Will you marry me?"** pop-up each time the site opens. Saying yes starts our song.
- **Our song** ([YouTube](https://www.youtube.com/watch?v=SuPCTBmISzQ&t=47s)) plays on a loop from 0:47. Use the gold ♪ button to pause or resume.
- A **countdown** to 16 October 2032.
- A **verse of the day** and **promise of the day**, the same for both of us and changing at midnight.
- **The three pillars of marriage:** lifelong fellowship to grow closer to Christ, intimacy within marriage, and offspring.
- **Our roles in Christ** as husband, as wife, and together.
- **Our promises** to love, to serve, and to honor and pray.
- **Verses for our bond**, grouped by theme.

Scripture is quoted from the New King James Version (NKJV).

## Put it online (GitHub Pages, one time)

1. Open the repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch that holds these files (for example `claude/tender-dijkstra-76q8ae`, or `main` if you merge into it). Set the folder to **/ (root)**, then click **Save**.
4. After a minute or two the site is live at **https://ustogetherwithchrist-us.github.io/commitment/**. Add it to both phones' home screens.

Free GitHub Pages needs the repository to be **public**, so anyone with the link can see the site.

## Changing things

- **Verses, promises, pillars, roles:** edit `js/content.js`.
- **Wedding date / song:** the constants at the top of `js/main.js` (`WEDDING`, `SONG_ID`, `SONG_START`).
- **Colors and fonts:** the variables at the top of `css/style.css`.

### About the music

Browsers don't let a page play sound until someone taps it, so the song starts when you tap **Yes**. If YouTube can't be reached, or the video's owner has turned off embedding, the ♪ button becomes a **"Play our song on YouTube"** link instead.

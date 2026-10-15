# Jemimah & Joel · Holy Matrimony

**Jemimah Nirmala Chinta weds Joel Raj Vemuri · 16 October 2032**

A website for the two of us to open every day: to be loved, to stay in love, to grow in Christ, and to wait well for our wedding day.

## What's inside

- **A sealed envelope every time it opens.** Tap the wine-red wax seal, the letter rises, and it asks "Will you marry me?" Each "yes" is counted.
- **Our song.** "Goodness of God" (Bethel Music, instrumental cover) starts playing muted as the page loads. The sound comes on with the first tap (the seal), and the song loops from 0:47. The gold "now playing" button pauses and resumes it.
- **Until We Say "I Do".** A live countdown to 16 October 2032, the months, weeks and Sundays of worship left, the next milestone (such as 2,000 days to go) and an "Add to calendar" button.
- **Our Daily Altar.** Each day brings a verse, a promise, a question to talk about, a prayer prompt, and the day's chapter of Proverbs. Both phones show the same ones, and they change at midnight. A "We prayed together today" button keeps count.
- **Love Letters.** Write a note, seal it and send the link (WhatsApp, SMS, anything). It opens inside the wax-sealed envelope on the other phone. The letter travels inside the link itself, so it is never stored on a server. Sent and received letters are kept on each phone.
- **Holy Matrimony**, with the paper-cut bride and groom, and **The Three Pillars of Marriage**: lifelong fellowship to grow closer to Christ, intimacy within marriage, and offspring.
- **Our Roles in Christ**, **Our Promises**, and **The Vows We Will Speak**, adapted from the traditional Book of Common Prayer vows.
- **Preparing Together.** A checklist for the waiting years, from praying daily to pre-marital counseling.
- **Verses for Our Bond**, grouped by theme, and **A Prayer for Us** to pray together.
- **Gentle touches.** A menu to move around the long page, soft candle-light that pulses with the song's beat, and an icon for your home screen.

All Scripture is from the New King James Version (NKJV). Every verse has been checked word for word against the NKJV on Bible Gateway.

## Put it online (GitHub Pages, one time)

1. Open the repository on GitHub, go to **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch that holds these files (for example `claude/tender-dijkstra-76q8ae`, or `main` if you merge into it). Set the folder to **/ (root)**, then click **Save**.
4. After a minute or two the site is live at **https://ustogetherwithchrist-us.github.io/commitment/**.
5. On each phone, open it and choose **Add to Home Screen**. It then opens like an app.

Free GitHub Pages needs the repository to be **public**, so anyone with the link can see the site. Love letters are not stored on the site; they live only in the links you send each other.

## Changing things

- **Verses, promises, pillars, roles, daily questions, prayer prompts, checklist:** edit `js/content.js`.
- **Wedding date and song:** `WEDDING` and the `SONG` settings at the top of `js/main.js`.
- **Colors and fonts:** the variables at the top of `css/style.css`.

### About the music

Browsers don't let a page play sound until someone taps it. So the song starts playing muted, and the sound comes on with your first tap.

If YouTube can't be reached, or the video's owner turns off embedding, the music button becomes a "Play our song on YouTube" link instead.

Browsers also don't let a website listen to a YouTube video's sound. With YouTube, the candle-light pulses on the song's beat (63 BPM for "Goodness of God"), kept in step with where the song is playing. Adjust it with `bpm` and `beatOffset` in `SONG`. To make the lights react to the real audio, put your own copy of the song at `audio/song.mp3`. The site then plays that file instead, from 0:47 and looping.

### What is saved where

The yes count, prayer count, checklist ticks and kept letters are saved in each phone's browser. They are not shared between your two phones, and clearing the browser's data removes them.

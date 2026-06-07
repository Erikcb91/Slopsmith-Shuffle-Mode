# SHUFFLE

![JSON](https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB.svg?style=flat&logo=Python&logoColor=white)

*Unlock Your Music, Unleash the Shuffle*

---

## Overview

**Shuffle** is a plugin for Slopsmith that provides advanced music shuffling and discovery features for your local music library. You can use it from the "Plugins" menu or just by clicking the "Shuffle" button on the main screen. English and Spanish languages supported.

### Shuffle Button

<img width="1586" height="167" alt="image" src="https://github.com/user-attachments/assets/1634afa0-1c85-44b9-80d2-e0dd1b2d7f4f" />

### Features

- 🔄 Automatically shuffle when a song ends
- 🎵 Filter by artist
- 🔁 Anti-repeat functionality
- 📋 Playlist summary popup
- ⚡ Lightweight and fast
- 🎚️ Customizable shuffle behavior

### Plugin Settings

<img width="450" height="610" alt="image" src="https://github.com/user-attachments/assets/5f0e7d1d-c0a5-40d0-bff3-5d439a928ff0" />

### Next song popup

It also features a popup when a song is finished showind a countdown (you can change the seconds in the plugin settings), the next song info (title, artist, album, album cover, and tuning).

<img width="350" height="226" alt="2026-06-07 19-34-13" src="https://github.com/user-attachments/assets/42524b70-70b4-4017-bc5e-79958f09b6eb" />


---

## Project Structure

    shuffle/
    ├── plugin.json
    ├── README.md
    ├── routes.py
    ├── screen.html
    └── screen.js

| File | Description |
|------|-------------|
| `plugin.json` | Plugin metadata and configuration |
| `routes.py` | Backend API routes and shuffle logic |
| `screen.html` | Plugin user interface |
| `screen.js` | Frontend functionality and settings |

---

## Getting Started

### Prerequisites

- Slopsmith
- Python 3.8+

---

## Installation

### Method 1: Install from Slopsmith

1. Open **Slopsmith**
2. Open **Plugins**
3. Click **Install Plugin from URL**
4. Paste "**https://github.com/Erikcb91/Slopsmith-Shuffle-Mode**"
5. Click **Install**

---

### Method 2: Manual Installation

Clone the repository:

    git clone https://github.com/Erikcb91/Slopsmith-Shuffle-Mode

Copy the `shuffle` folder into:

    %APPDATA%\Slopsmith\current\resources\slopsmith\plugins\shuffle

The full expanded path is typically:

    C:\Users\<YourUsername>\AppData\Roaming\Slopsmith\current\resources\slopsmith\plugins\shuffle

Restart Slopsmith after installation.

---

### Method 3: Other Manual Installation

    Download the repo as a Zip file
    
    Extract the files to "C:\Users\<YourUsername>\AppData\Roaming\Slopsmith\current\resources\slopsmith\plugins\shuffle"
    
    If the "shuffle" folder doesn't exist create it.
    
---

## Usage

1. Open the Shuffle plugin.
2. Configure your shuffle preferences.
3. Enable auto-advance if desired.
4. Optionally:
   - Filter by artist
   - Enable anti-repeat
   - Adjust delay timing
5. Start playback and let Shuffle handle the rest.

## OR
1.  Open the Shuffle plugin.
2. Configure your shuffle preferences.
3. Go back to your library and click the "Shuffle" button.
   
---
## Roadmap

For the reasons stated below, there is no roadmap, i might take a look on filtering by tuning, but i don't promise anything.

---

⚠️ **Disclaimer:** This is fully **VIBE CODED** don't expect me to know why it fails if it does. I just wanted to have the option to play in a "random mode" so i did this. Also don't expect too many updates (if any).

---

[Back to Top](#shuffle)

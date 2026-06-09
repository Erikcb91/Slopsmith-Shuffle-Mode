# SHUFFLE
![JSON](https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB.svg?style=flat&logo=Python&logoColor=white)

*Unlock Your Music, Unleash the Shuffle*

---

⚠️ **Disclaimer:** This is fully **VIBE CODED** don't expect me to know why it fails if it does. I just wanted to have the option to play in a "random mode" so i did this. Also don't expect too many updates (if any).

---

## Overview

**Shuffle** is a plugin for Slopsmith that provides advanced music shuffling and discovery features for your local music library. You can use it from the "Plugins" menu or just by clicking the "Shuffle" button on the main screen. English and Spanish languages supported.

### Features

- ▶️ Play songs automatically
- 🔄 Automatically shuffle when a song ends
- 🎵 Filter by artist
- 🎸 Filter by tuning (E Standard, Eb Standard, Drop D… whatever's in your library)
- 🔁 Anti-repeat functionality
- 📋 Playlist summary popup with album art, title, artist and tuning of the next song
- ⏭️ **Skip the current song** (via popup or highway button)
- 🔁 **Resume** the original song if you skip by mistake (popup with Resume button)
- 🚪 **Exit shuffle mode** from popup or a dedicated button on the highway
- 🎨 **Auto theme** – popup colours adapt to the app's active theme
- ⚡ Lightweight and fast
- 🎚️ Customizable shuffle behavior
- 🌐 Language support (English and Spanish)

<br>

### Shuffle Button

<img width="1586" height="167" alt="image" src="https://github.com/user-attachments/assets/1634afa0-1c85-44b9-80d2-e0dd1b2d7f4f" />

<br>

### Plugin Settings

<img width="450" height="730" alt="image" src="https://github.com/user-attachments/assets/d5730f0e-9aac-4a31-835c-518657bc359f" />

<br>

### Next song popup with Skip and Exit

<img width="350" height="226" alt="o-gif" src="https://github.com/user-attachments/assets/9fbafb9f-6ffb-4fe5-9c28-865e0834e236" />

<br>

### Highway buttons (Skip current & Stop Shuffle)

<img width="500" alt="highway-buttons" src="https://github.com/user-attachments/assets/placeholder-highway.png" />

---

## Project Structure
shuffle/
plugin.json
README.md
routes.py
screen.html
screen.js

text

| File | Description |
|------|-------------|
| `plugin.json` | Plugin metadata and configuration |
| `routes.py` | Backend API routes — random/next song, artists, tunings |
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
4. Paste `https://github.com/Erikcb91/Slopsmith-Shuffle-Mode`
5. Click **Install**

---

### Method 2: Manual Installation

Clone the repository:
git clone https://github.com/Erikcb91/Slopsmith-Shuffle-Mode

text

Copy the `shuffle` folder into:
%APPDATA%\Slopsmith\current\resources\slopsmith\plugins\shuffle

text

The full expanded path is typically:
C:\Users<YourUsername>\AppData\Roaming\Slopsmith\current\resources\slopsmith\plugins\shuffle

text

Restart Slopsmith after installation.

---

### Method 3: Manual Installation (ZIP)

1. Download the repo as a ZIP file
2. Extract the files to:
C:\Users<YourUsername>\AppData\Roaming\Slopsmith\current\resources\slopsmith\plugins\shuffle

text
3. If the `shuffle` folder doesn't exist, create it.
4. Restart Slopsmith.

---

## Usage

1. Open the Shuffle plugin.
2. Configure your shuffle preferences.
3. Enable auto-advance if desired.
4. Optionally:
- Filter by artist
- Filter by tuning
- Enable anti-repeat
- Adjust delay timing
5. Start playback and let Shuffle handle the rest.

### OR

1. Open the Shuffle plugin.
2. Configure your shuffle preferences.
3. Go back to your library and click the **🔀 Shuffle** button.

### New interactive features

- **Skip current song** (highway button) → pauses the song and shows a popup with:
- **Skip this song** → load a new random song (skip confirmed)
- **Resume** → continue playing the original song
- **Exit** → exit shuffle mode and go back to the library
- **Stop Shuffle** (highway button) → instantly exit shuffle mode
- Popup buttons are always centred, with a countdown and two dividers for a clean layout.

---

## Roadmap

For the reasons stated above, there is no roadmap.

- [x] Filter by artist
- [x] Filter by tuning
- [x] Skip current song (popup + highway)
- [x] Resume original song on skip
- [x] Exit shuffle mode from popup / highway
- [x] Auto theme (follow the app's active theme)

---

[Back to Top](#shuffle)
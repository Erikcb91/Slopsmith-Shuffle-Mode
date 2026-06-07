# SHUFFLE

![JSON](https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB.svg?style=flat&logo=Python&logoColor=white)

*Unlock Your Music, Unleash the Shuffle*

---

## Overview

**Shuffle** is a plugin for Slopsmith that provides advanced music shuffling and discovery features for your local music library.

### Features

- 🔄 Automatically shuffle when a song ends
- 🎵 Filter by artist
- 🚫 Exclude specific artists
- 🔁 Anti-repeat functionality
- 📋 Playlist summary popup
- ⚡ Lightweight and fast
- 🎚️ Customizable shuffle behavior

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
4. Paste this repository URL
5. Click **Install**

---

### Method 2: Manual Installation

Clone the repository:

    git clone <repository-url>

Copy the `shuffle` folder into:

    %APPDATA%\Slopsmith\current\resources\slopsmith\plugins\shuffle

The full expanded path is typically:

    C:\Users\<YourUsername>\AppData\Roaming\Slopsmith\current\resources\slopsmith\plugins\shuffle

Restart Slopsmith after installation.

---

## Usage

1. Open the Shuffle plugin.
2. Configure your shuffle preferences.
3. Enable auto-advance if desired.
4. Optionally:
   - Filter by artist
   - Exclude artists
   - Enable anti-repeat
   - Adjust delay timing
5. Start playback and let Shuffle handle the rest.

---

## License

MIT License

---

## Acknowledgments

- Slopsmith
- Contributors
- Open-source community

---

[Back to Top](#shuffle)
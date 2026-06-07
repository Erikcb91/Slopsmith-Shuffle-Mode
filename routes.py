"""
slopsmith-plugin-shuffle — routes.py  (v3)
Fix: tuning uses column 'tuning_name' (human-readable), not 'tuning' (offsets).
"""

_meta_db = None


def setup(app, context):
    global _meta_db
    _meta_db = context["meta_db"]

    def _pick(artist: str = "", tuning: str = "", avoid: str = ""):
        params = []
        where  = ["1=1"]

        if artist:
            where.append("LOWER(artist) LIKE LOWER(?)")
            params.append(f"%{artist}%")

        if tuning:
            where.append("LOWER(tuning_name) = LOWER(?)")
            params.append(tuning)

        if avoid:
            ids = [a.strip() for a in avoid.split(",") if a.strip()]
            if ids:
                where.append(f"filename NOT IN ({','.join('?' * len(ids))})")
                params.extend(ids)

        sql = (
            f"SELECT filename, title, artist, album, tuning_name "
            f"FROM songs WHERE {' AND '.join(where)} ORDER BY RANDOM() LIMIT 1"
        )
        row = _meta_db.conn.execute(sql, params).fetchone()
        if not row:
            return None
        return {
            "filename": row[0],
            "title":    row[1],
            "artist":   row[2],
            "album":    row[3],
            "tuning":   row[4] or "",
        }

    @app.get("/api/plugins/shuffle/random")
    def shuffle_random(artist: str = "", tuning: str = "", avoid: str = ""):
        try:
            song = _pick(artist=artist, tuning=tuning, avoid=avoid)
            return song if song else {"error": "no_songs"}
        except Exception as e:
            return {"error": str(e)}

    @app.get("/api/plugins/shuffle/next")
    def shuffle_next(artist: str = "", tuning: str = "", avoid: str = ""):
        return shuffle_random(artist=artist, tuning=tuning, avoid=avoid)

    @app.get("/api/plugins/shuffle/artists")
    def shuffle_artists():
        try:
            rows = _meta_db.conn.execute(
                "SELECT DISTINCT artist FROM songs "
                "WHERE artist IS NOT NULL AND artist != '' "
                "ORDER BY LOWER(artist)"
            ).fetchall()
            return {"artists": [r[0] for r in rows]}
        except Exception as e:
            return {"error": str(e), "artists": []}

    @app.get("/api/plugins/shuffle/tunings")
    @app.get("/api/plugins/shuffle/tunings")
    def shuffle_tunings():
        try:
            rows = _meta_db.conn.execute(
                "SELECT DISTINCT tuning FROM songs "
                "WHERE tuning IS NOT NULL AND tuning != '' "
                "AND tuning NOT LIKE '-%' "
                "AND tuning NOT GLOB '[0-9]*' "
                "AND tuning NOT GLOB '-[0-9]*' "
                "ORDER BY LOWER(tuning)"
            ).fetchall()
            return {"tunings": [r[0] for r in rows]}
        except Exception as e:
            return {"error": str(e), "tunings": []}

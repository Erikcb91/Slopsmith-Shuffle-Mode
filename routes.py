"""
slopsmith-plugin-shuffle — routes.py
"""

_meta_db = None

def setup(app, context):
    global _meta_db
    _meta_db = context["meta_db"]

    # Verificar si la tabla songs tiene columna 'tuning'
    has_tuning = False
    try:
        cursor = _meta_db.conn.execute("PRAGMA table_info(songs)")
        columns = [col[1] for col in cursor.fetchall()]
        has_tuning = 'tuning' in columns
    except:
        pass

    @app.get("/api/plugins/shuffle/random")
    def shuffle_random(artist: str = "", avoid: str = ""):
        try:
            params = []
            where = ["1=1"]

            if artist:
                where.append("LOWER(artist) LIKE LOWER(?)")
                params.append(f"%{artist}%")

            if avoid:
                ids = [a.strip() for a in avoid.split(",") if a.strip()]
                if ids:
                    placeholders = ','.join(['?'] * len(ids))
                    where.append(f"filename NOT IN ({placeholders})")
                    params.extend(ids)

            if has_tuning:
                sql = f"SELECT filename, title, artist, album, tuning FROM songs WHERE {' AND '.join(where)} ORDER BY RANDOM() LIMIT 1"
            else:
                sql = f"SELECT filename, title, artist, album FROM songs WHERE {' AND '.join(where)} ORDER BY RANDOM() LIMIT 1"

            row = _meta_db.conn.execute(sql, params).fetchone()
            if not row:
                return {"error": "no_songs"}

            result = {
                "filename": row[0],
                "title": row[1],
                "artist": row[2],
                "album": row[3]
            }
            if has_tuning and len(row) > 4:
                result["tuning"] = row[4] if row[4] else None
            return result

        except Exception as e:
            return {"error": str(e)}

    @app.get("/api/plugins/shuffle/next")
    def shuffle_next(artist: str = "", avoid: str = ""):
        """Obtiene la siguiente canción sin reproducirla"""
        try:
            params = []
            where = ["1=1"]

            if artist:
                where.append("LOWER(artist) LIKE LOWER(?)")
                params.append(f"%{artist}%")

            if avoid:
                ids = [a.strip() for a in avoid.split(",") if a.strip()]
                if ids:
                    placeholders = ','.join(['?'] * len(ids))
                    where.append(f"filename NOT IN ({placeholders})")
                    params.extend(ids)

            if has_tuning:
                sql = f"SELECT filename, title, artist, album, tuning FROM songs WHERE {' AND '.join(where)} ORDER BY RANDOM() LIMIT 1"
            else:
                sql = f"SELECT filename, title, artist, album FROM songs WHERE {' AND '.join(where)} ORDER BY RANDOM() LIMIT 1"

            row = _meta_db.conn.execute(sql, params).fetchone()
            if not row:
                return {"error": "no_songs"}

            result = {
                "filename": row[0],
                "title": row[1],
                "artist": row[2],
                "album": row[3]
            }
            if has_tuning and len(row) > 4:
                result["tuning"] = row[4] if row[4] else None
            return result

        except Exception as e:
            return {"error": str(e)}

    @app.get("/api/plugins/shuffle/artists")
    def shuffle_artists():
        try:
            rows = _meta_db.conn.execute(
                "SELECT DISTINCT artist FROM songs WHERE artist IS NOT NULL AND artist != '' ORDER BY LOWER(artist)"
            ).fetchall()
            return {"artists": [r[0] for r in rows]}
        except Exception as e:
            return {"error": str(e), "artists": []}
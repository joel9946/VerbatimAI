#	db.py
#	This	file's	job:	save	a	record	of	every	question	asked	and
#	every	answer	given	into	our	Postgres	database,	so	we	can
#4.7	—	app/main.py
#Job	of	this	file:	the	front	door	of	our	backend	—	a	FastAPI	app	that	ties	retrieve.py,	generate.py,	and	db.py	together	into	one	working	pipeline.
#	review	performance	later	(this	is	our	"monitoring").
import psycopg2
import datetime
try:
    from app import config
except ImportError:
    import config
def get_connection():
    """Opens a fresh connection to our Postgres database."""
    if not config.DATABASE_URL or not config.DATABASE_URL.startswith(("postgresql://", "postgres://")):
        print("Warning: Invalid or missing DATABASE_URL. Must start with postgresql://")
        return None
    try:
        return psycopg2.connect(config.DATABASE_URL, connect_timeout=5)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def init_db():
    """
    Creates the 'logs' table if it doesn't already exist.
    Safe to run every time the app starts.
    """
    conn = get_connection()
    if not conn:
        print("Skipping init_db: database connection not available.")
        return
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP,
                question TEXT,
                answer TEXT,
                top_source TEXT,
                top_score FLOAT,
                latency_ms INTEGER
            );
        """)
        conn.commit()
        cur.close()
    except Exception as e:
        print(f"Error during init_db: {e}")
    finally:
        conn.close()

def log_interaction(question, answer, top_source, top_score, latency_ms):
    """Inserts one row into the logs table for a single question/answer."""
    conn = get_connection()
    if not conn:
        print("Skipping log_interaction: database connection not available.")
        return
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO logs (created_at, question, answer, top_source, top_score, latency_ms)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (datetime.datetime.now(), question, answer, top_source, top_score, latency_ms),
        )
        conn.commit()
        cur.close()
    except Exception as e:
        print(f"Error logging interaction to DB: {e}")
    finally:
        conn.close()

def get_history(limit=50):
    """Retrieves recent logged interactions from Postgres."""
    conn = get_connection()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, created_at, question, answer, top_source, top_score, latency_ms
            FROM logs
            ORDER BY created_at DESC
            LIMIT %s;
            """,
            (limit,)
        )
        rows = cur.fetchall()
        cur.close()
        history = []
        for row in rows:
            created_at_val = None
            if row[1]:
                created_at_val = row[1].isoformat() if hasattr(row[1], "isoformat") else str(row[1])
            history.append({
                "id": row[0],
                "created_at": created_at_val,
                "question": row[2],
                "answer": row[3],
                "top_source": row[4],
                "top_score": row[5],
                "latency_ms": row[6]
            })
        return history
    except Exception as e:
        print(f"Error fetching history from DB: {e}")
        return []
    finally:
        conn.close()
import mysql.connector
from mysql.connector import Error
from flask import g, current_app

# Datenbankverbindungsdaten
DB_CONFIG = {
    'host': 'localhost',
    'database': 'authdata',
    'user': 'Admin',
    'password': 'root@master123',
    'auth_plugin': 'mysql_native_password'  # Verwende Standard-Authentifizierung
}

def get_db():
    """Verbindung zur Datenbank herstellen, falls noch nicht verbunden."""
    if 'db' not in g:
        try:
            # Verbindung zum MySQL-Server herstellen
            connection = mysql.connector.connect(**DB_CONFIG)
            
            if connection.is_connected():
                g.db = connection
                g.cursor = connection.cursor(dictionary=True)
                current_app.logger.info("Verbindung zur MySQL-Datenbank hergestellt")
                
                # Stelle sicher, dass die Datenbank existiert
                g.cursor.execute("CREATE DATABASE IF NOT EXISTS authdata")
                g.cursor.execute("USE authdata")
                
                # Initialisiere die Tabellen
                init_tables(g.db, g.cursor)
                
        except Error as e:
            current_app.logger.error(f"Fehler bei der Verbindung zur MySQL-Datenbank: {e}")
            # Fallback zu einer leeren Verbindung, um Fehler zu vermeiden
            g.db = None
            g.cursor = None
            
    return g.db, g.cursor

def close_db(e=None):
    """Datenbankverbindung schließen."""
    cursor = g.pop('cursor', None)
    db = g.pop('db', None)
    
    if cursor is not None:
        cursor.close()
    
    if db is not None and hasattr(db, 'is_connected') and db.is_connected():
        db.close()
        current_app.logger.info("MySQL-Datenbankverbindung geschlossen")

def init_tables(db, cursor):
    """Initialisiere die erforderlichen Tabellen, falls sie nicht existieren."""
    if db is None or cursor is None:
        current_app.logger.error("Kann Tabellen nicht initialisieren: Keine Datenbankverbindung")
        return
    
    try:
        # Erstelle users-Tabelle, falls sie nicht existiert
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        db.commit()
        current_app.logger.info("Tabellen erfolgreich initialisiert")
    except Error as e:
        current_app.logger.error(f"Fehler beim Initialisieren der Tabellen: {e}")

def init_db():
    """Initialisiere die Datenbankverbindung und Tabellen."""
    db, cursor = get_db()
    if db is None:
        current_app.logger.warning("Konnte keine Verbindung zur Datenbank herstellen. Verwende SQLite als Fallback.")
        # Hier könnte ein Fallback zu SQLite implementiert werden

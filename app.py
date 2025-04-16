from flask import Flask, render_template, request, jsonify, redirect, url_for, session, g
import os
import logging
from logging.handlers import RotatingFileHandler
from werkzeug.security import generate_password_hash, check_password_hash
from database import init_db, get_db, close_db
import sqlite3
from ad_conn import ActiveDirectoryManager
import json
from datetime import datetime, timedelta
import threading
import time

# Fallback SQLite-Datenbank für den Fall, dass MySQL nicht verfügbar ist
SQLITE_DATABASE = 'users.db'

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.teardown_appcontext(close_db)

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

file_handler = RotatingFileHandler('logs/app.log', maxBytes=1024*1024*10, backupCount=5)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)

stream_handler = logging.StreamHandler()
stream_handler.setLevel(logging.INFO)

app.logger.addHandler(file_handler)
app.logger.addHandler(stream_handler)
app.logger.setLevel(logging.INFO)

# SQLite-Fallback-Funktionen
def get_sqlite_db():
    """Verbindung zur SQLite-Datenbank herstellen."""
    if 'sqlite_db' not in g:
        g.sqlite_db = sqlite3.connect(SQLITE_DATABASE)
        g.sqlite_db.row_factory = sqlite3.Row
    return g.sqlite_db

def close_sqlite_db(e=None):
    """SQLite-Datenbankverbindung schließen."""
    db = g.pop('sqlite_db', None)
    if db is not None:
        db.close()

def init_sqlite_db():
    """Initialisiere die SQLite-Datenbank als Fallback."""
    db = get_sqlite_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.commit()

# AD data collection background thread
def collect_ad_data():
    """Background thread to collect AD data periodically"""
    with app.app_context():
        while True:
            try:
                app.logger.info("Starting AD data collection...")
                ad_manager = ActiveDirectoryManager()
                
                # Get dashboard data (includes users, groups, computers)
                data = ad_manager.get_dashboard_data()
                
                # Add metadata if not already present
                data['metadata'] = {
                    'timestamp': datetime.now().isoformat(),
                    'server': ad_manager.domain_controller
                }
                
                # Save to file
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'ad_data/ad_data_{timestamp}.json'
                
                # Create directory if it doesn't exist
                if not os.path.exists('ad_data'):
                    os.makedirs('ad_data')
                
                with open(filename, 'w') as f:
                    json.dump(data, f, indent=2)
                
                app.logger.info(f"AD data saved to {filename}")
                ad_manager.disconnect()
                
                # Sleep for 5 minutes before next collection
                time.sleep(300)
            except Exception as e:
                app.logger.error(f"Error collecting AD data: {str(e)}")
                # Sleep for 1 minute before retry on error
                time.sleep(60)

# Initialisiere die Datenbank
with app.app_context():
    try:
        app.logger.info("Versuche, MySQL-Datenbank zu initialisieren...")
        init_db()
    except Exception as e:
        app.logger.error(f"Fehler bei der MySQL-Initialisierung: {e}")
        app.logger.info("Verwende SQLite als Fallback...")
        init_sqlite_db()

# Set environment variables for Active Directory if not already set
if not os.environ.get('AD_DOMAIN_CONTROLLER'):
    os.environ['AD_DOMAIN_CONTROLLER'] = 'dc01.test.local'
if not os.environ.get('AD_DOMAIN'):
    os.environ['AD_DOMAIN'] = 'test.local'
if not os.environ.get('AD_USERNAME'):
    os.environ['AD_USERNAME'] = 'TEST\\Administrator'
if not os.environ.get('AD_PASSWORD'):
    os.environ['AD_PASSWORD'] = 'root@master123'

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    if request.is_json:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
    else:
        email = request.form.get('email')
        password = request.form.get('password')
    
    try:
        # Versuche MySQL-Verbindung
        db, cursor = get_db()
        if db is not None and cursor is not None:
            cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
            user = cursor.fetchone()
        else:
            # Fallback zu SQLite
            app.logger.info("Verwende SQLite für Login...")
            db = get_sqlite_db()
            user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    except Exception as e:
        app.logger.error(f"Fehler bei der Datenbankabfrage: {e}")
        # Fallback zu SQLite
        app.logger.info("Fallback zu SQLite für Login...")
        db = get_sqlite_db()
        user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    
    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['user_name'] = user['name']
        session['user_email'] = user['email']
        
        return jsonify({'success': True, 'message': 'Login successful'})
    
    return jsonify({'success': False, 'message': 'Invalid email or password'})

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')
    
    if request.is_json:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
    else:
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
    
    # Hash das Passwort
    hashed_password = generate_password_hash(password)
    
    try:
        # Versuche MySQL-Verbindung
        db, cursor = get_db()
        if db is not None and cursor is not None:
            # Prüfe, ob E-Mail bereits existiert
            cursor.execute('SELECT id FROM users WHERE email = %s', (email,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': 'Email already registered'})
            
            # Füge den neuen Benutzer hinzu
            cursor.execute(
                'INSERT INTO users (name, email, password) VALUES (%s, %s, %s)',
                (name, email, hashed_password)
            )
            db.commit()
        else:
            # Fallback zu SQLite
            app.logger.info("Verwende SQLite für Registrierung...")
            db = get_sqlite_db()
            
            # Prüfe, ob E-Mail bereits existiert
            if db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
                return jsonify({'success': False, 'message': 'Email already registered'})
            
            # Füge den neuen Benutzer hinzu
            db.execute(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                (name, email, hashed_password)
            )
            db.commit()
    except Exception as e:
        app.logger.error(f"Fehler bei der Registrierung: {e}")
        # Fallback zu SQLite
        app.logger.info("Fallback zu SQLite für Registrierung...")
        db = get_sqlite_db()
        
        # Prüfe, ob E-Mail bereits existiert
        if db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
            return jsonify({'success': False, 'message': 'Email already registered'})
        
        # Füge den neuen Benutzer hinzu
        db.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            (name, email, hashed_password)
        )
        db.commit()
    
    return jsonify({'success': True, 'message': 'Registration successful'})

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    
    user = {
        'id': session['user_id'],
        'name': session['user_name'],
        'email': session['user_email']
    }
    
    return render_template('dashboard.html', user=user)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/ad-dashboard')
def ad_dashboard():
    """Active Directory management dashboard"""
    if 'user_id' not in session:
        return redirect(url_for('index'))
    
    user = {
        'id': session['user_id'],
        'name': session['user_name'],
        'email': session['user_email']
    }
    
    return render_template('ad_dashboard.html', user=user)

@app.route('/api/ad/users')
def get_ad_users():
    """API endpoint to get Active Directory users"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    ad_manager = ActiveDirectoryManager()
    users = ad_manager.get_users()
    ad_manager.disconnect()
    
    return jsonify({'success': True, 'users': users})

@app.route('/api/ad/groups')
def get_ad_groups():
    """API endpoint to get Active Directory groups"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    ad_manager = ActiveDirectoryManager()
    groups = ad_manager.get_groups()
    ad_manager.disconnect()
    
    return jsonify({'success': True, 'groups': groups})

@app.route('/api/ad/user/<username>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_ad_user(username):
    """API endpoint to manage a specific AD user"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    app.logger.info(f"User API call for: {username}, method: {request.method}")
    ad_manager = ActiveDirectoryManager()
    
    try:
        if request.method == 'GET':
            # Get user details using sAMAccountName
            try:
                users = ad_manager.get_users(filter=f"(sAMAccountName={username})")
                app.logger.info(f"Users fetched: {users}")
            except Exception as e:
                app.logger.error(f"Error fetching user: {str(e)}", exc_info=True)
                ad_manager.disconnect()
                return jsonify({'success': False, 'message': f'Error fetching user: {str(e)}'}), 500
            
            ad_manager.disconnect()
            
            if users:
                user = users[0]
                return jsonify({'success': True, 'user': user})
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        elif request.method == 'POST':
            # Create new user
            data = request.get_json()
            success, message = ad_manager.create_user(
                username=username,
                first_name=data.get('firstName'),
                last_name=data.get('lastName'),
                password=data.get('password'),
                email=data.get('email')
            )
            ad_manager.disconnect()
            
            if success:
                return jsonify({'success': True, 'message': message})
            return jsonify({'success': False, 'message': message}), 400
        
        elif request.method == 'PUT':
            # Update user (enable/disable or reset password)
            data = request.get_json()
            app.logger.info(f"PUT data: {data}")
            
            action = data.get('action')
            if not action:
                return jsonify({'success': False, 'message': 'Action is required'}), 400
            
            if action == 'enable':
                success, message = ad_manager.enable_user(username)
            elif action == 'disable':
                success, message = ad_manager.disable_user(username)
            elif action == 'reset_password':
                password = data.get('password')
                if not password:
                    return jsonify({'success': False, 'message': 'Password is required for reset'}), 400
                success, message = ad_manager.reset_password(username, password)
            else:
                return jsonify({'success': False, 'message': f'Invalid action: {action}'}), 400
            
            ad_manager.disconnect()
            if success:
                return jsonify({'success': True, 'message': message})
            return jsonify({'success': False, 'message': message}), 400
        
        elif request.method == 'DELETE':
            # Not implementing user deletion for safety reasons
            ad_manager.disconnect()
            return jsonify({'success': False, 'message': 'User deletion not implemented'}), 501
            
    except Exception as e:
        app.logger.error(f"Unexpected error in user management API: {str(e)}", exc_info=True)
        ad_manager.disconnect()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/ad/group/<group_name>/members', methods=['GET', 'POST', 'DELETE'])
def manage_ad_group_members(group_name):
    """API endpoint to manage group membership"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    app.logger.info(f"Group members API call for: {group_name}, method: {request.method}")
    ad_manager = ActiveDirectoryManager()
    
    try:
        if request.method == 'GET':
            app.logger.info(f"Fetching members for group: {group_name}")
            try:
                # Fetch all groups
                groups = ad_manager.get_groups()
                app.logger.info(f"Groups fetched: {groups}")
            except Exception as e:
                app.logger.error(f"Error fetching groups: {str(e)}", exc_info=True)
                ad_manager.disconnect()
                return jsonify({'success': False, 'message': f'Error fetching groups: {str(e)}'}), 500
            
            # Filter the group by name
            group = next((g for g in groups if g.get('cn', '').lower() == group_name.lower()), None)
            if not group:
                app.logger.warning(f"Group not found: {group_name}")
                ad_manager.disconnect()
                return jsonify({'success': False, 'message': f'Group {group_name} not found'}), 404
            
            # Log the entire group object for debugging
            app.logger.info(f"Group details: {group}")
            
            # Extract members
            members = group.get('members', [])
            
            # Log the raw members data
            app.logger.info(f"Raw members data: {members}, type: {type(members)}")
            
            if isinstance(members, str):
                members = [members]
            elif not members:
                members = []
            
            app.logger.info(f"Found {len(members)} members for group {group_name}")
            ad_manager.disconnect()
            return jsonify({'success': True, 'members': members})
        
        elif request.method == 'POST':
            # Add user to group
            data = request.get_json()
            username = data.get('username')
            
            success, message = ad_manager.add_user_to_group(username, group_name)
            ad_manager.disconnect()
            
            if success:
                return jsonify({'success': True, 'message': message})
            return jsonify({'success': False, 'message': message}), 400
        
        elif request.method == 'DELETE':
            data = request.get_json()
            user_dn = data.get('dn')
            if not user_dn:
                return jsonify({'success': False, 'message': 'User DN is required'}), 400
            
            if success:
                return jsonify({'success': True, 'message': message})
            return jsonify({'success': False, 'message': message}), 400
            
    except Exception as e:
        app.logger.error(f"Unexpected error in group members API: {str(e)}", exc_info=True)
        ad_manager.disconnect()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500
def manage_ad_group_members(group_name):
    """API endpoint to manage group membership"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    app.logger.info(f"Group members API call for: {group_name}, method: {request.method}")
    ad_manager = ActiveDirectoryManager()
    
    try:
        if request.method == 'GET':
            app.logger.info(f"Fetching members for group: {group_name}")
            try:
                # Fetch all groups
                groups = ad_manager.get_groups()
                app.logger.info(f"Groups fetched: {groups}")
            except Exception as e:
                app.logger.error(f"Error fetching groups: {str(e)}", exc_info=True)
                ad_manager.disconnect()
                return jsonify({'success': False, 'message': f'Error fetching groups: {str(e)}'}), 500
            
            # Filter the group by name
            group = next((g for g in groups if g.get('cn', '').lower() == group_name.lower()), None)
            if not group:
                app.logger.warning(f"Group not found: {group_name}")
                ad_manager.disconnect()
                return jsonify({'success': False, 'message': f'Group {group_name} not found'}), 404
            
            # Log the entire group object for debugging
            app.logger.info(f"Group details: {group}")
            
            # Extract members
            members = group.get('member', [])
            
            # Log the raw members data
            app.logger.info(f"Raw members data: {members}, type: {type(members)}")
            
            if isinstance(members, str):
                members = [members]
            elif not members:
                members = []
            
            app.logger.info(f"Found {len(members)} members for group {group_name}")
            ad_manager.disconnect()
            return jsonify({'success': True, 'members': members})
        
        elif request.method == 'POST':
            # Add user to group
            data = request.get_json()
            username = data.get('username')
            
            success, message = ad_manager.add_user_to_group(username, group_name)
            ad_manager.disconnect()
            
            if success:
                return jsonify({'success': True, 'message': message})
            return jsonify({'success': False, 'message': message}), 400
        
        elif request.method == 'DELETE':
            data = request.get_json()
            user_dn = data.get('dn')
            if not user_dn:
                return jsonify({'success': False, 'message': 'User DN is required'}), 400
            
            success, message = ad_manager.remove_user_from_group(user_dn, group_name)
            ad_manager.disconnect()
            if success:
                return jsonify({'success': True, 'message': message})
            return jsonify({'success': False, 'message': message}), 400
            
    except Exception as e:
        app.logger.error(f"Unexpected error in group members API: {str(e)}", exc_info=True)
        ad_manager.disconnect()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/dashboard-data')
def dashboard_data():
    """API endpoint to fetch aggregated dashboard data."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    try:
        # Try to use latest cached data first for faster response
        try:
            ad_data_files = [f for f in os.listdir('ad_data') if f.startswith('ad_data_') and f.endswith('.json')]
            if ad_data_files:
                # Get most recent file
                latest_file = sorted(ad_data_files)[-1]
                with open(f'ad_data/{latest_file}', 'r') as f:
                    data = json.load(f)
                    app.logger.info(f"Using cached AD data from {latest_file}")
                    # Update the timestamp to show we're using cached data
                    if 'metadata' in data:
                        data['metadata']['source'] = 'cache'
                    return jsonify(data)
        except Exception as e:
            app.logger.error(f"Error loading cached AD data: {str(e)}")
        
        # If no cached data or error, try live data
        ad_manager = ActiveDirectoryManager()
        data = ad_manager.get_dashboard_data()
        ad_manager.disconnect()
        
        if not data:
            app.logger.warning("No AD data returned from manager")
            raise Exception("No data returned from AD manager")
        
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Error in dashboard data API: {str(e)}")
        # Return error data with more details
        return jsonify({
            'success': False,
            'error': str(e),
            'users': 0,
            'groups': 0,
            'computers': 0,
            'domainControllers': 0,
            'userDetails': [],
            'groupDetails': [],
            'computerDetails': [],
            'metadata': {
                'timestamp': datetime.now().isoformat(),
                'server': 'Error fetching data',
                'error': str(e)
            }
        })

# Add a new debug endpoint to check API connectivity
@app.route('/api/debug')
def api_debug():
    """Debug endpoint to verify API connectivity"""
    try:
        # Return system information for debugging
        import platform
        import sys
        import time
        from datetime import datetime
        
        debug_info = {
            'success': True,
            'message': 'API is reachable',
            'timestamp': datetime.now().isoformat(),
            'python_version': sys.version,
            'platform': platform.platform(),
            'server_time': time.ctime(),
            'ad_config': {
                'domain_controller': os.environ.get('AD_DOMAIN_CONTROLLER', 'Not set'),
                'domain': os.environ.get('AD_DOMAIN', 'Not set'),
            }
        }
        
        # Test database connection
        try:
            db, cursor = get_db()
            if db is not None and cursor is not None:
                debug_info['database'] = {
                    'status': 'connected',
                    'type': 'MySQL',
                }
            else:
                debug_info['database'] = {
                    'status': 'failed',
                    'type': 'MySQL',
                    'fallback': 'Using SQLite'
                }
        except Exception as e:
            debug_info['database'] = {
                'status': 'error',
                'message': str(e),
                'fallback': 'Using SQLite'
            }
        
        # Look for AD data files
        try:
            ad_data_files = [f for f in os.listdir('ad_data') if f.startswith('ad_data_') and f.endswith('.json')]
            debug_info['ad_data_files'] = {
                'count': len(ad_data_files),
                'latest': sorted(ad_data_files)[-1] if ad_data_files else None
            }
        except Exception as e:
            debug_info['ad_data_files'] = {
                'error': str(e)
            }
        
        return jsonify(debug_info)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'API debug error',
            'error': str(e)
        })

def start_background_threads():
    """Start background threads for data collection"""
    app.logger.info("Starting AD data collection background thread")
    ad_thread = threading.Thread(target=collect_ad_data, daemon=True)
    ad_thread.start()


if __name__ == '__main__':
    start_background_threads()
    app.run(debug=True, host='192.168.1.70', port=5000)

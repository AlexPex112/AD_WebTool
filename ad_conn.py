import os
import json
import ssl
from datetime import datetime
from flask import current_app
from ldap3 import Server, Connection, Tls, NTLM, ALL, MODIFY_REPLACE, SUBTREE
from ldap3.core.exceptions import LDAPException, LDAPBindError, LDAPEntryAlreadyExistsResult, LDAPOperationResult

class ActiveDirectoryManager:
    def __init__(self, domain_controller=None, domain=None, username=None, password=None):
        """Initialize AD connection manager with credentials"""
        self.domain_controller = domain_controller or os.environ.get('AD_DOMAIN_CONTROLLER', 'name.domain.domain')
        self.domain = domain or os.environ.get('AD_DOMAIN', 'domain.domain')
        self.username = username or os.environ.get('AD_USERNAME', 'domain\\Usernamen')
        self.password = password or os.environ.get('AD_PASSWORD', 'password')
        self.conn = None
        self.server = None
        
        # Convert domain to LDAP base DN format
        self.base_dn = ','.join([f'DC={part}' for part in self.domain.split('.')])
        
    def connect(self):
        """Connect to Active Directory via LDAPS"""
        try:
            if not self.domain_controller:
                raise ValueError("Domain controller address is not set")

            # Configure TLS for LDAPS
            tls = Tls(validate=ssl.CERT_NONE, version=ssl.PROTOCOL_TLSv1_2)

            # Create Server object
            self.server = Server(
                host=self.domain_controller,
                port=636,  # LDAPS port
                use_ssl=True,
                tls=tls,
                get_info=ALL
            )

            if not self.server:
                raise ValueError(f"Invalid server address: {self.domain_controller}")

            # Create Connection object with NTLM authentication
            self.conn = Connection(
                self.server,
                user=self.username,
                password=self.password,
                authentication=NTLM,
                auto_bind=True
            )

            if not self.conn.bound:
                raise LDAPBindError("Failed to bind to the server")

            current_app.logger.info(f"Successfully connected to AD server {self.domain_controller} using LDAPS")
            return True
        except LDAPBindError as e:
            current_app.logger.error(f"Failed to bind to AD server: {str(e)}")
            self.conn = None
            return False
        except Exception as e:
            current_app.logger.error(f"Failed to connect to AD: {str(e)}")
            self.conn = None
            return False

    def disconnect(self):
        """Disconnect from LDAP server"""
        if self.conn and self.conn.bound:
            self.conn.unbind()
            current_app.logger.info("Disconnected from AD server")
        else:
            current_app.logger.warning("Attempted to disconnect, but no active connection exists")
    
    def get_users(self, custom_filter=None):
        """Get AD users using an optional custom LDAP filter."""
        try:
            if not self.conn:
                if not self.connect():
                    return []
            search_base = self.base_dn
            if custom_filter:
                ldap_filter = f"(&(objectClass=user)(objectCategory=person){custom_filter})"
            else:
                ldap_filter = '(&(objectClass=user)(objectCategory=person))'
            attributes = ['sAMAccountName', 'cn', 'givenName', 'sn', 'mail', 'userAccountControl']

            self.conn.search(search_base=search_base, search_filter=ldap_filter,
                             search_scope=SUBTREE, attributes=attributes)

            users = []
            for entry in self.conn.entries:
                user_data = entry.entry_attributes_as_dict

                # Avoid list index errors by checking length
                given_name_vals = user_data.get('givenName', [])
                sn_vals = user_data.get('sn', [])
                mail_vals = user_data.get('mail', [])
                enabled = True
                if 'userAccountControl' in user_data:
                    enabled = (int(user_data['userAccountControl'][0]) & 2) == 0

                users.append({
                    'sAMAccountName': user_data.get('sAMAccountName', [''])[0],
                    'cn': user_data.get('cn', [''])[0],
                    'givenName': given_name_vals[0] if len(given_name_vals) > 0 else '',
                    'sn': sn_vals[0] if len(sn_vals) > 0 else '',
                    'mail': mail_vals[0] if len(mail_vals) > 0 else '',
                    'enabled': enabled
                })
            return users
        except Exception as e:
            current_app.logger.error(f"Error fetching AD users: {str(e)}")
            # Return some mock data for testing when AD is not available
            return [
                {'sAMAccountName': 'testuser1', 'cn': 'Test User 1', 'mail': 'testuser1@test.local', 'enabled': True},
                {'sAMAccountName': 'testuser2', 'cn': 'Test User 2', 'mail': 'testuser2@test.local', 'enabled': False}
            ]

    def get_groups(self):
        """Get all AD groups using SUBTREE search."""
        try:
            if not self.conn:
                if not self.connect():
                    return []
            search_base = self.base_dn
            ldap_filter = '(objectClass=group)'
            attributes = ['cn', 'description', 'member']

            self.conn.search(search_base=search_base, search_filter=ldap_filter,
                             search_scope=SUBTREE, attributes=attributes)

            groups = []
            for entry in self.conn.entries:
                group_data = entry.entry_attributes_as_dict
                desc_vals = group_data.get('description', [])
                group_members = group_data.get('member', [])
                if not isinstance(group_members, list):
                    group_members = [group_members]
                current_app.logger.info(f"Raw LDAP entry for group: {entry}")
                current_app.logger.info(f"Group {group_data.get('cn', [''])[0]} members: {group_members}")
                if not group_members:
                    current_app.logger.warning(f"Group {group_data.get('cn', [''])[0]} has no members")
                else:
                    current_app.logger.info(f"Group {group_data.get('cn', [''])[0]} members: {group_members}")
                groups.append({
                    'cn': group_data.get('cn', [''])[0],
                    'description': desc_vals[0] if len(desc_vals) > 0 else '',
                    'member_count': len(group_members),
                    'members': group_members
                })
            return groups
        except Exception as e:
            current_app.logger.error(f"Error fetching AD groups: {str(e)}")
            # Return some mock data for testing when AD is not available
            return [
                {'cn': 'Domain Admins', 'description': 'Domain Administrators', 'member_count': 3},
                {'cn': 'Domain Users', 'description': 'All domain users', 'member_count': 15}
            ]

    def get_computers(self):
        """Get AD computers using LDAP"""
        try:
            if not self.conn:
                if not self.connect():
                    return []
            ldap_filter = '(objectClass=computer)'
            self.conn.search(self.base_dn, ldap_filter, SUBTREE,
                             attributes=['name', 'dNSHostName', 'operatingSystem', 'userAccountControl'])

            computers = []
            for entry in self.conn.entries:
                computer_data = entry.entry_attributes_as_dict
                host_vals = computer_data.get('dNSHostName', [])
                uac = int(computer_data['userAccountControl'][0]) if 'userAccountControl' in computer_data else 0
                enabled = (uac & 2) == 0
                computers.append({
                    'name': computer_data.get('name', [''])[0],
                    'dnsHostName': host_vals[0] if len(host_vals) > 0 else '',
                    'status': 'Online' if enabled else 'Offline'
                })
            return computers
        except Exception as e:
            current_app.logger.error(f"Error fetching AD computers: {str(e)}")
            # Return some mock data for testing when AD is not available
            return [
                {'name': 'DESKTOP-A1B2C3', 'dnsHostName': 'desktop-a1b2c3.test.local', 'status': 'Online'},
                {'name': 'LAPTOP-X1Y2Z3', 'dnsHostName': 'laptop-x1y2z3.test.local', 'status': 'Offline'}
            ]
    
    def get_domain_controllers(self):
        """Get AD domain controllers using LDAP"""
        try:
            if not self.conn:
                if not self.connect():
                    return []
            
            # LDAP filter for domain controllers
            ldap_filter = '(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=8192))'
            
            # Execute search
            self.conn.search(
                search_base=self.base_dn,
                search_filter=ldap_filter,
                search_scope=SUBTREE,
                attributes=['name', 'dNSHostName', 'operatingSystem']
            )
            
            # Process results
            dcs = []
            for entry in self.conn.entries:
                dc_data = entry.entry_attributes_as_dict
                
                dc = {
                    'name': dc_data.get('name', [''])[0],
                    'dnsHostName': dc_data.get('dNSHostName', [''])[0] if 'dNSHostName' in dc_data else '',
                    'operatingSystem': dc_data.get('operatingSystem', [''])[0] if 'operatingSystem' in dc_data else ''
                }
                dcs.append(dc)
            
            return dcs
        except Exception as e:
            current_app.logger.error(f"Error fetching AD domain controllers: {str(e)}")
            # Return some mock data for testing when AD is not available
            return [
                {'name': 'DC01', 'dnsHostName': 'dc01.test.local', 'operatingSystem': 'Windows Server 2019'}
            ]

    def get_dashboard_data(self):
        """Aggregate data for the dashboard."""
        try:
            users = self.get_users()
            groups = self.get_groups()
            computers = self.get_computers()
            domain_controllers = self.get_domain_controllers()

            # Format user data for table display
            user_details = []
            for user in users[:10]:  # Limit to first 10 users for display
                user_details.append({
                    'Name': user.get('cn', ''),
                    'Username': user.get('sAMAccountName', ''),
                    'Email': user.get('mail', ''),
                    'Status': 'Active' if user.get('enabled', False) else 'Disabled'
                })

            # Format group data for table display
            group_details = []
            for group in groups[:10]:  # Limit to first 10 groups
                group_details.append({
                    'Group Name': group.get('cn', ''),
                    'Description': group.get('description', ''),
                    'Members': str(group.get('member_count', 0))
                })

            # Format computer data for table display
            computer_details = []
            for computer in computers[:10]:  # Limit to first 10 computers
                computer_details.append({
                    'Computer Name': computer.get('name', ''),
                    'IP Address': computer.get('dnsHostName', ''),
                    'Status': computer.get('status', '')
                })

            return {
                'users': len(users),
                'groups': len(groups),
                'computers': len(computers),
                'domainControllers': len(domain_controllers),
                'userDetails': user_details,
                'groupDetails': group_details,
                'computerDetails': computer_details
            }
        except Exception as e:
            current_app.logger.error(f"Error fetching dashboard data: {str(e)}")
            # Return mock data for testing
            return {
                'users': 2,
                'groups': 2,
                'computers': 2,
                'domainControllers': 1,
                'userDetails': [
                    {'Name': 'Test User 1', 'Username': 'testuser1', 'Email': 'testuser1@test.local', 'Status': 'Active'},
                    {'Name': 'Test User 2', 'Username': 'testuser2', 'Email': 'testuser2@test.local', 'Status': 'Disabled'}
                ],
                'groupDetails': [
                    {'Group Name': 'Domain Admins', 'Description': 'Domain Administrators', 'Members': '3'},
                    {'Group Name': 'Domain Users', 'Description': 'All domain users', 'Members': '15'}
                ],
                'computerDetails': [
                    {'Computer Name': 'DESKTOP-A1B2C3', 'IP Address': 'desktop-a1b2c3.test.local', 'Status': 'Online'},
                    {'Computer Name': 'LAPTOP-X1Y2Z3', 'IP Address': 'laptop-x1y2z3.test.local', 'Status': 'Offline'}
                ]
            }

    def create_user(self, username, first_name, last_name, password, email=None, ou_path=None):
        """Create a new user in Active Directory using LDAP"""
        try:
            if not self.conn:
                self.connect()
            
            # Set default path if not specified
            if not ou_path:
                ou_path = f"CN=Users,{self.base_dn}"
            
            # Create distinguished name for new user
            user_dn = f"CN={first_name} {last_name},{ou_path}"
            
            # Define user attributes
            user_attrs = {
                'objectClass': ['top', 'person', 'organizationalPerson', 'user'],
                'cn': f"{first_name} {last_name}",
                'sAMAccountName': username,
                'userPrincipalName': f"{username}@{self.domain}",
                'givenName': first_name,
                'sn': last_name,
                'displayName': f"{first_name} {last_name}",
                'userAccountControl': '512'  # Normal account, enabled
            }
            
            if email:
                user_attrs['mail'] = email
            
            # Add the user
            self.conn.add(user_dn, attributes=user_attrs)
            
            if not self.conn.result['result'] == 0:
                return False, f"Failed to create user: {self.conn.result['description']}"
            
            # Set the password
            encoded_password = '"{}"'.format(password).encode('utf-16-le')
            self.conn.modify(
                user_dn,
                {'unicodePwd': [(MODIFY_REPLACE, [encoded_password])]}
            )
            
            if not self.conn.result['result'] == 0:
                return False, f"User created but failed to set password: {self.conn.result['description']}"
            
            # Enable the account
            self.conn.modify(
                user_dn,
                {'userAccountControl': [(MODIFY_REPLACE, ['512'])]}  # Normal account, enabled
            )
            
            return True, "User created successfully"
        except LDAPEntryAlreadyExistsResult:
            return False, "A user with this name already exists"
        except Exception as e:
            current_app.logger.error(f"Error creating AD user: {str(e)}")
            return False, str(e)
    
    def disable_user(self, username):
        """Disable a user account in Active Directory using LDAP"""
        try:
            if not self.conn:
                self.connect()
            
            # Find the user DN
            user_filter = f"(sAMAccountName={username})"
            search_base = self.base_dn
            
            self.conn.search(
                search_base=search_base,
                search_filter=user_filter,
                search_scope=SUBTREE,
                attributes=['userAccountControl']
            )
            
            if len(self.conn.entries) == 0:
                current_app.logger.error(f"User {username} not found in search results: {self.conn.entries}")
                return False, f"User {username} not found"
            current_app.logger.info(f"Search results for {username}: {self.conn.entries}")
                
            user_dn = self.conn.entries[0].entry_dn
            
            # Get current UAC value
            current_uac = self.conn.entries[0].userAccountControl.value
            
            # Set bit 2 (value 2) to disable account
            new_uac = current_uac | 2
            
            # Update the account
            self.conn.modify(
                user_dn,
                {'userAccountControl': [(MODIFY_REPLACE, [str(new_uac)])]}
            )
            
            if self.conn.result['result'] == 0:
                return True, "User disabled successfully"
            else:
                return False, f"Failed to disable user: {self.conn.result['description']}"
        except Exception as e:
            current_app.logger.error(f"Error disabling AD user: {str(e)}")
            return False, str(e)
    
    def enable_user(self, username):
        """Enable a user account in Active Directory using LDAP"""
        try:
            if not self.conn:
                self.connect()
            
            # Find the user DN
            user_filter = f"(sAMAccountName={username})"
            search_base = self.base_dn
            
            self.conn.search(
                search_base=search_base,
                search_filter=user_filter,
                search_scope=SUBTREE,
                attributes=['userAccountControl']
            )
            
            if len(self.conn.entries) == 0:
                current_app.logger.error(f"User {username} not found in search results")
                return False, f"User {username} not found"
            current_app.logger.info(f"Search results for {username}: {self.conn.entries}")
                
            user_dn = self.conn.entries[0].entry_dn
            
            # Get current UAC value
            current_uac = self.conn.entries[0].userAccountControl.value
            
            # Clear bit 2 (value 2) to enable account
            new_uac = current_uac & ~2  # Clear bit 2 to enable account
            current_app.logger.info(f"Enabling user {username}: Current UAC={current_uac}, New UAC={new_uac}")
            
            # Update the account
            self.conn.modify(
                user_dn,
                {'userAccountControl': [(MODIFY_REPLACE, [str(new_uac)])]}
            )
            
            if self.conn.result['result'] == 0:
                return True, "User enabled successfully"
            else:
                return False, f"Failed to enable user: {self.conn.result['description']}"
        except Exception as e:
            current_app.logger.error(f"Error enabling AD user: {str(e)}")
            return False, str(e)
    
    def reset_password(self, username, new_password):
        """Reset a user's password in Active Directory using LDAP"""
        try:
            if not self.conn:
                self.connect()
            
            # Check if username is a DN; if not, fetch the DN
            if ',' not in username:  # Simple check for DN format
                user_filter = f"(sAMAccountName={username})"
                self.conn.search(
                    search_base=self.base_dn,
                    search_filter=user_filter,
                    search_scope=SUBTREE,
                    attributes=['distinguishedName']
                )
                if len(self.conn.entries) == 0:
                    return False, f"User {username} not found"
                username = self.conn.entries[0].entry_dn
            
            # Set the new password
            encoded_password = ('"' + new_password + '"').encode('utf-16-le')
            current_app.logger.info(f"Resetting password for {username} with encoded password: {encoded_password}")
            self.conn.modify(
                username,
                {'unicodePwd': [(MODIFY_REPLACE, [encoded_password])]}
            )
            
            if self.conn.result['result'] == 0:
                return True, "Password reset successfully"
            else:
                return False, f"Failed to reset password: {self.conn.result['description']}"
        except Exception as e:
            current_app.logger.error(f"Error resetting AD user password: {str(e)}")
            return False, str(e)

    def add_user_to_group(self, username, group_name):
        """Add a user to an AD group using LDAP"""
        try:
            if not self.conn:
                self.connect()
            
            # Find the user DN
            user_filter = f"(sAMAccountName={username})"
            search_base = f"CN=Users,{self.base_dn}"
            
            self.conn.search(
                search_base=search_base,
                search_filter=user_filter,
                search_scope=SUBTREE,
                attributes=['distinguishedName']
            )
            
            if len(self.conn.entries) == 0:
                return False, f"User {username} not found"
                
            user_dn = self.conn.entries[0].entry_dn
            
            # Find the group DN
            group_filter = f"(cn={group_name})"
            self.conn.search(
                search_base=self.base_dn,
                search_filter=group_filter,
                search_scope=SUBTREE,
                attributes=['member']
            )
            
            if len(self.conn.entries) == 0:
                return False, f"Group {group_name} not found"
            
            group_dn = self.conn.entries[0].entry_dn
            
            # Check if user is already a member
            group_members = self.conn.entries[0].member.values
            if user_dn in group_members:
                return True, f"User is already a member of {group_name}"
            
            # Add user to group
            self.conn.modify(
                group_dn,
                {'member': [(MODIFY_REPLACE, group_members + [user_dn])]}
            )
            
            if self.conn.result['result'] == 0:
                return True, f"User added to {group_name} successfully"
            else:
                return False, f"Failed to add user to group: {self.conn.result['description']}"
        except Exception as e:
            current_app.logger.error(f"Error adding user to group: {str(e)}")
            return False, str(e)

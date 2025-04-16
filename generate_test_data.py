import json
import os
import random
from datetime import datetime

# Ensure directory exists
if not os.path.exists('ad_data'):
    os.makedirs('ad_data')

# Generate mock data
mock_data = {
    'users': random.randint(10, 50),
    'groups': random.randint(5, 15),
    'computers': random.randint(5, 20),
    'domainControllers': random.randint(1, 3),
    'userDetails': [
        {
            'Name': f'User {i}',
            'Username': f'user{i}',
            'Email': f'user{i}@test.local',
            'Status': random.choice(['Active', 'Disabled'])
        }
        for i in range(1, 11)  # Generate 10 users
    ],
    'groupDetails': [
        {
            'Group Name': f'Group {i}',
            'Description': f'Description for Group {i}',
            'Members': str(random.randint(1, 15))
        }
        for i in range(1, 6)  # Generate 5 groups
    ],
    'computerDetails': [
        {
            'Computer Name': f'COMPUTER{i}',
            'IP Address': f'192.168.1.{100 + i}',
            'Status': random.choice(['Online', 'Offline'])
        }
        for i in range(1, 7)  # Generate 6 computers
    ],
    'metadata': {
        'timestamp': datetime.now().isoformat(),
        'server': 'test-dc.test.local'
    }
}

# Save to file
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
filename = f'ad_data/ad_data_{timestamp}.json'

with open(filename, 'w') as f:
    json.dump(mock_data, f, indent=2)

print(f"Test data saved to {filename}")

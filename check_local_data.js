// Check what data exists in local storage
console.log('Checking local storage data...');

// This will run in the browser console
const script = `
console.log('=== LOCAL STORAGE DATA ===');
console.log('All localStorage keys:', Object.keys(localStorage));

// Check for user data
const userData = localStorage.getItem('todoAppData_' + localStorage.getItem('todoAppCurrentUser')?.match(/"id":"([^"]+)"/)?.[1]);
if (userData) {
    console.log('User data found:', JSON.parse(userData));
} else {
    console.log('No user data found');
}

// Check for current user
const currentUser = localStorage.getItem('todoAppCurrentUser');
if (currentUser) {
    console.log('Current user:', JSON.parse(currentUser));
} else {
    console.log('No current user found');
}

// Check for global data
const globalData = localStorage.getItem('todoApp');
if (globalData) {
    console.log('Global data found:', JSON.parse(globalData));
} else {
    console.log('No global data found');
}

// Check for users
const users = localStorage.getItem('todoAppUsers');
if (users) {
    console.log('Users found:', JSON.parse(users));
} else {
    console.log('No users found');
}
`;

console.log('Run this in your browser console:');
console.log(script);

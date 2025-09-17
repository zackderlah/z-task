// This script will help find your data by checking all possible storage locations
// Run this in your browser console

console.log('=== COMPREHENSIVE DATA SEARCH ===');

// Check all localStorage keys
console.log('1. Checking all localStorage keys:');
const allKeys = Object.keys(localStorage);
console.log('Total keys:', allKeys.length);

allKeys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`Key: ${key}`);
    console.log(`Length: ${value ? value.length : 0} characters`);
    
    // Try to parse as JSON
    try {
        const parsed = JSON.parse(value);
        if (parsed && (parsed.folders || parsed.projects || parsed.projectData)) {
            console.log('🎯 FOUND POTENTIAL DATA!');
            console.log('Data structure:', Object.keys(parsed));
            if (parsed.folders) {
                console.log('Folders:', parsed.folders.map(f => f.name));
            }
            if (parsed.projects) {
                console.log('Projects:', parsed.projects.map(p => p.name));
            }
        }
    } catch (e) {
        // Not JSON, that's fine
    }
    console.log('---');
});

// Check sessionStorage
console.log('2. Checking sessionStorage:');
const sessionKeys = Object.keys(sessionStorage);
console.log('Session keys:', sessionKeys);

// Check for any data that might contain "business" or "personal"
console.log('3. Searching for business/personal data:');
allKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && (value.toLowerCase().includes('business') || value.toLowerCase().includes('personal'))) {
        console.log(`🎯 Found business/personal data in key: ${key}`);
        console.log('Value:', value.substring(0, 500) + '...');
    }
});

// Check for any data that might contain project names
console.log('4. Searching for project data:');
allKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && (value.includes('project') || value.includes('task') || value.includes('column'))) {
        console.log(`🎯 Found project/task data in key: ${key}`);
        try {
            const parsed = JSON.parse(value);
            console.log('Parsed data keys:', Object.keys(parsed));
        } catch (e) {
            console.log('Raw value preview:', value.substring(0, 200) + '...');
        }
    }
});

console.log('=== SEARCH COMPLETE ===');

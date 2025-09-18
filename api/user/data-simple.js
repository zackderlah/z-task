const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // Check if authorization header is present
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        // Try to authenticate the user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const userId = user.id;

        if (req.method === 'GET') {
            // Get user data - simplified
            try {
                const { data: folders, error: foldersError } = await supabase
                    .from('folders')
                    .select('*')
                    .eq('user_id', userId);

                const { data: projects, error: projectsError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('user_id', userId);

                res.json({
                    folders: folders || [],
                    uncategorized: projects || [],
                    success: true
                });
            } catch (error) {
                console.error('Error fetching data:', error);
                res.status(500).json({ error: 'Failed to fetch data' });
            }

        } else if (req.method === 'POST') {
            // Save user data - simplified
            try {
                const { folders, uncategorized } = req.body;

                // Clear existing data
                await supabase.from('folders').delete().eq('user_id', userId);
                await supabase.from('projects').delete().eq('user_id', userId);

                // Insert new folders
                if (folders && folders.length > 0) {
                    for (const folder of folders) {
                        await supabase.from('folders').insert({
                            user_id: userId,
                            name: folder.name,
                            expanded: folder.expanded !== false
                        });
                    }
                }

                // Insert new projects
                if (uncategorized && uncategorized.length > 0) {
                    for (const project of uncategorized) {
                        await supabase.from('projects').insert({
                            user_id: userId,
                            name: project.name,
                            description: project.description || ''
                        });
                    }
                }

                res.json({ message: 'Data saved successfully' });
            } catch (error) {
                console.error('Error saving data:', error);
                res.status(500).json({ error: 'Failed to save data' });
            }
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

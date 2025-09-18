const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token' });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userId = user.id;

        if (req.method === 'GET') {
            // Get user data - ultra simple approach
            try {
                // Just get the raw data from a simple table
                const { data, error } = await supabase
                    .from('user_data')
                    .select('data')
                    .eq('user_id', userId)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                    console.error('Error fetching user data:', error);
                    return res.status(500).json({ error: 'Failed to fetch data' });
                }

                const userData = data?.data || { folders: [], uncategorized: [] };
                console.log('Loaded user data:', userData);
                res.json(userData);

            } catch (error) {
                console.error('Error fetching data:', error);
                res.status(500).json({ error: 'Failed to fetch data' });
            }

        } else if (req.method === 'POST') {
            // Save user data - ultra simple approach
            try {
                const userData = req.body;
                console.log('Saving user data:', userData);

                // First, delete any existing data for this user
                const { error: deleteError } = await supabase
                    .from('user_data')
                    .delete()
                    .eq('user_id', userId);

                if (deleteError) {
                    console.error('Error deleting existing data:', deleteError);
                    // Continue anyway, might not exist
                }

                // Then insert new data
                const { error: insertError } = await supabase
                    .from('user_data')
                    .insert({
                        user_id: userId,
                        data: userData
                    });

                if (insertError) {
                    console.error('Error saving user data:', insertError);
                    return res.status(500).json({ error: 'Failed to save data', details: insertError.message });
                }

                console.log('User data saved successfully');
                res.json({ message: 'Data saved successfully' });

            } catch (error) {
                console.error('Error saving data:', error);
                res.status(500).json({ error: 'Failed to save data', details: error.message });
            }
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
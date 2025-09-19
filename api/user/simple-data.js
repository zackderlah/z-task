const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // Get user ID from the request body or headers (simple approach)
        let userId = null;
        
        if (req.method === 'POST') {
            userId = req.body.userId || req.headers['x-user-id'];
        } else if (req.method === 'GET') {
            userId = req.query.userId || req.headers['x-user-id'];
        }
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        if (req.method === 'GET') {
            // Get user data - direct database access
            try {
                const { data, error } = await supabase
                    .from('user_data')
                    .select('data')
                    .eq('user_id', userId)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching user data:', error);
                    return res.status(500).json({ error: 'Failed to fetch data' });
                }

                const userData = data?.data || { folders: [], uncategorized: [] };
                console.log('Loaded user data for user:', userId);
                console.log('Raw data from DB:', data);
                console.log('Parsed user data:', userData);
                console.log('Folders array:', userData.folders);
                console.log('First folder:', userData.folders?.[0]);
                res.json(userData);

            } catch (error) {
                console.error('Error fetching data:', error);
                res.status(500).json({ error: 'Failed to fetch data' });
            }

        } else if (req.method === 'POST') {
            // Save user data - direct database access
            try {
                const userData = req.body.data;
                console.log('Saving user data for user:', userId);
                console.log('Data to save:', JSON.stringify(userData, null, 2));

                // Use upsert to handle both insert and update
                const { data: upsertData, error: upsertError } = await supabase
                    .from('user_data')
                    .upsert({
                        user_id: userId,
                        data: userData
                    }, {
                        onConflict: 'user_id'
                    })
                    .select();

                if (upsertError) {
                    console.error('Error saving user data:', upsertError);
                    return res.status(500).json({ error: 'Failed to save data', details: upsertError.message });
                }

                console.log('User data saved successfully for user:', userId);
                console.log('Upserted data:', upsertData);
                res.json({ message: 'Data saved successfully', upsertedData: upsertData });

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

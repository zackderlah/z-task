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
        const userId = req.query.userId || req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        // Get all data from user_data table for this user
        const { data, error } = await supabase
            .from('user_data')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            return res.status(500).json({ 
                error: 'Database error', 
                details: error.message,
                code: error.code
            });
        }

        // Also check if the table exists and is accessible
        const { data: tableInfo, error: tableError } = await supabase
            .from('user_data')
            .select('*')
            .limit(1);

        res.json({
            userId: userId,
            userData: data || [],
            tableAccessible: !tableError,
            tableError: tableError?.message,
            totalRecords: data?.length || 0,
            sampleData: data?.[0] || null
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Unexpected error', 
            details: error.message 
        });
    }
};

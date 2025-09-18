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
        // Test if we can connect to Supabase
        const { data, error } = await supabase
            .from('user_data')
            .select('*')
            .limit(1);

        if (error) {
            return res.status(500).json({ 
                error: 'Database error', 
                details: error.message,
                code: error.code,
                hint: error.hint
            });
        }

        res.json({ 
            message: 'Table exists and accessible',
            data: data,
            tableExists: true
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Unexpected error', 
            details: error.message 
        });
    }
};

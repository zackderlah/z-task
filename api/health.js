const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

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
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ 
                error: 'Missing Supabase credentials',
                SUPABASE_URL_SET: !!supabaseUrl,
                SUPABASE_ANON_KEY_SET: !!supabaseKey
            });
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Test basic connection
        const { data, error } = await supabase
            .from('folders')
            .select('count')
            .limit(1);
        
        if (error) {
            return res.json({
                status: 'unhealthy',
                error: error.message,
                code: error.code,
                details: error.details
            });
        }
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            version: '1.0.0'
        });
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            stack: error.stack
        });
    }
};
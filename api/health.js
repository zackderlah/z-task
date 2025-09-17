module.exports = async (req, res) => {
    try {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
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

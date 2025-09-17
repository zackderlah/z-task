module.exports = async (req, res) => {
    try {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        res.json({
            supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
            supabaseKey: supabaseKey ? 'Set' : 'Missing',
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseKey,
            urlLength: supabaseUrl ? supabaseUrl.length : 0,
            keyLength: supabaseKey ? supabaseKey.length : 0
        });
    } catch (error) {
        res.json({
            error: error.message,
            stack: error.stack
        });
    }
};

module.exports = async (req, res) => {
    try {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return res.json({ error: 'Missing Supabase credentials' });
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Test basic connection
        const { data, error } = await supabase
            .from('folders')
            .select('count')
            .limit(1);
        
        if (error) {
            return res.json({
                success: false,
                error: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
        }
        
        // Test if we can create a test record
        const { data: testData, error: testError } = await supabase
            .from('folders')
            .select('*')
            .limit(1);
        
        res.json({
            success: true,
            connection: 'OK',
            tablesExist: !testError,
            testError: testError ? testError.message : null,
            sampleData: testData
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
};
